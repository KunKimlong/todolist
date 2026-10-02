"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HiChevronRight, HiPlus } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/auth/account-menu";
import { TodoFormDialog, type TodoDialogState } from "./todo-form-dialog";
import { DEFAULT_FILTERS, TodoFilters, hasActiveFilters, type Filters } from "./todo-filters";
import { TodoItem } from "./todo-item";
import { ApiError, todoApi } from "@/lib/api";
import { matchesDateFilter, sortTodos, type SortKey } from "@/lib/todo-utils";
import type { Todo, TodoFilter, TodoInput } from "@/lib/types";
import { cn } from "@/lib/utils";

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong";
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** How long Undo stays available before a delete is sent to the server */
const UNDO_WINDOW_MS = 5000;

const STATUS_TABS:{ value: TodoFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Open" },
  { value: "completed", label: "Done" },
];

export function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<TodoFilter>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("newest");
  const [dialog, setDialog] = useState<TodoDialogState>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  // Task id -> timer for deletes that are still inside their undo window
  const pendingDeletes = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const fetchTodos = useCallback(
    () =>
      todoApi
        .list()
        .then((data) => {
          setTodos(data);
          setLoadError(null);
        })
        .catch((err) => setLoadError(errorMessage(err)))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Press "N" anywhere (outside a text field) to open the New task dialog
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target) || document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      setDialog({ mode: "create" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // If the tab is closed or reloaded during an undo window, finish those deletes anyway
  useEffect(() => {
    const pending = pendingDeletes.current;
    function flush() {
      pending.forEach((timer, id) => {
        clearTimeout(timer);
        todoApi.removeOnUnload(id);
      });
      pending.clear();
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  function retryLoad() {
    setLoading(true);
    fetchTodos();
  }

  const replaceTodo = (updated: Todo) =>
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  async function handleCreate(input: TodoInput) {
    try {
      const created = await todoApi.create(input);
      setTodos((prev) => [created, ...prev]);
      toast("Task added");
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function handleUpdate(id: number, input: TodoInput) {
    try {
      replaceTodo(await todoApi.update(id, input));
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function handleToggle(todo: Todo) {
    // Optimistic update, rolled back if the request fails
    replaceTodo({ ...todo, completed: !todo.completed });
    try {
      replaceTodo(await todoApi.toggle(todo.id));
    } catch (err) {
      replaceTodo(todo);
      toast.error(errorMessage(err));
    }
  }

  /**
   * Hide tasks immediately but only delete them on the server once the undo
   * window has passed, so Undo restores the original tasks (same id, dates).
   */
  function deleteWithUndo(items: Todo[], message: string) {
    if (items.length === 0) return;
    const ids = new Set(items.map((t) => t.id));
    setTodos((prev) => prev.filter((t) => !ids.has(t.id)));

    const timer = setTimeout(async () => {
      ids.forEach((id) => pendingDeletes.current.delete(id));
      const results = await Promise.allSettled(items.map((t) => todoApi.remove(t.id)));
      // A 404 means it is already gone, which is what we wanted
      const failed = items.filter((_, i) => {
        const r = results[i];
        return r.status === "rejected" && !(r.reason instanceof ApiError && r.reason.status === 404);
      });
      if (failed.length > 0) {
        setTodos((prev) => [...failed, ...prev]);
        toast.error(`Couldn't delete ${failed.length === 1 ? "a task" : `${failed.length} tasks`}`);
      }
    }, UNDO_WINDOW_MS);
    ids.forEach((id) => pendingDeletes.current.set(id, timer));

    toast(message, {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(timer);
          ids.forEach((id) => pendingDeletes.current.delete(id));
          setTodos((prev) => [...items, ...prev]);
        },
      },
    });
  }

  function handleDelete(todo: Todo) {
    deleteWithUndo([todo], "Task deleted");
  }

  function handleClearCompleted() {
    // Only the completed tasks currently on screen, never ones hidden by a filter
    const n = doneTodos.length;
    deleteWithUndo(doneTodos, `Cleared ${n} completed ${n === 1 ? "task" : "tasks"}`);
  }

  const counts = useMemo(() => {
    const completed = todos.filter((t) => t.completed).length;
    return { all: todos.length, completed, active: todos.length - completed };
  }, [todos]);

  const { openTodos, doneTodos } = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const filtered = sortTodos(
      todos.filter((t) => {
        if (filters.priority !== "ALL" && t.priority !== filters.priority) return false;
        if (!matchesDateFilter(t, filters.date, filters.specificDate)) return false;
        return !q || t.title.toLowerCase().includes(q);
      }),
      sort,
    );
    return {
      openTodos: status === "completed" ? [] : filtered.filter((t) => !t.completed),
      doneTodos: status === "active" ? [] : filtered.filter((t) => t.completed),
    };
  }, [todos, status, filters, sort]);

  const filtering = hasActiveFilters(filters);
  const nothingToShow = openTodos.length === 0 && doneTodos.length === 0;
  const overdue = todos.filter((t) => !t.completed && matchesDateFilter(t, "overdue", "")).length;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const itemProps = {
    onToggle: handleToggle,
    onEdit: (t: Todo) => setDialog({ mode: "edit", todo: t }),
    onDelete: handleDelete,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-12 pb-28 sm:px-8 sm:pt-20">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tasks</h1>
          <p className="mt-2 flex flex-wrap gap-x-1.5 text-base text-muted-foreground">
            <span>{today}</span>
            {!loading && !loadError && (
              <span className="whitespace-nowrap">
                <span aria-hidden className="mr-1.5 hidden sm:inline">·</span>
                {counts.active === 0 ? "Nothing open" : `${counts.active} open`}
                {overdue > 0 && (
                  <span className="text-red-600 dark:text-red-400">, {overdue} overdue</span>
                )}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <AccountMenu />
          <Button size="lg" className="h-10 gap-2 px-4 text-[0.9375rem]" onClick={() => setDialog({ mode: "create" })} title="New task (N)">
            <HiPlus />
            New task
          </Button>
        </div>
      </header>

      <nav aria-label="Task status" className="mt-12 flex gap-8 border-b">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(tab.value)}
              className={cn(
                "-mb-px cursor-pointer border-b-2 pb-3 text-base transition-colors",
                active
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                {counts[tab.value === "active" ? "active" : tab.value === "completed" ? "completed" : "all"]}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-b py-3">
        <TodoFilters filters={filters} onChange={setFilters} sort={sort} onSortChange={setSort} />
      </div>

      {filtering && !loading && (
        <div className="flex items-center justify-between py-3 text-sm text-muted-foreground">
          <span>
            {openTodos.length + doneTodos.length} matching
          </span>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {loading ? (
        <div className="divide-y">
          {[64, 48, 72, 40].map((w, i) => (
            <div key={i} className="flex items-center gap-4 py-5">
              <Skeleton className="size-[22px] rounded-full" />
              <Skeleton className="h-5" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <Message title="Couldn't load your tasks" body={loadError}>
          <Button variant="outline" size="lg" className="h-10 px-4" onClick={retryLoad}>
            Try again
          </Button>
        </Message>
      ) : nothingToShow ? (
        filtering ? (
          <Message title="No tasks match" body="Try a different search or filter." />
        ) : status === "completed" ? (
          <Message title="Nothing completed yet" body="Tasks you finish will show up here." />
        ) : counts.all > 0 ? (
          <Message title="All done" body="You've finished everything on your list." />
        ) : (
          <Message title="No tasks yet" body="Add something you want to get done.">
            <Button variant="outline" size="lg" className="h-10 px-4" onClick={() => setDialog({ mode: "create" })}>
              <HiPlus /> New task
            </Button>
          </Message>
        )
      ) : (
        <>
          {openTodos.length > 0 && (
            <ul className="divide-y">
              {openTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} {...itemProps} />
              ))}
            </ul>
          )}

          {doneTodos.length > 0 && (
            <section className={cn(openTodos.length > 0 && "mt-10")}>
              <div className="flex items-center justify-between border-b pb-3">
                {status === "all" ? (
                  <button
                    type="button"
                    onClick={() => setShowCompleted((v) => !v)}
                    aria-expanded={showCompleted}
                    className="flex cursor-pointer items-center gap-1.5 text-[0.9375rem] text-muted-foreground hover:text-foreground"
                  >
                    <HiChevronRight
                      className={cn("size-4 transition-transform", showCompleted && "rotate-90")}
                    />
                    Completed
                    <span className="ml-0.5 text-sm tabular-nums">{doneTodos.length}</span>
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {doneTodos.length} completed
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="cursor-pointer text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              </div>
              {(showCompleted || status === "completed") && (
                <ul className="divide-y">
                  {doneTodos.map((todo) => (
                    <TodoItem key={todo.id} todo={todo} {...itemProps} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <TodoFormDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </main>
  );
}

function Message({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-20 text-center">
      <p className="text-base font-medium">{title}</p>
      <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">{body}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
