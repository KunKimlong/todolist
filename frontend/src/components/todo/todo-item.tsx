"use client";

import {
  HiOutlineCalendar,
  HiOutlineEllipsisHorizontal,
  HiOutlineFlag,
  HiOutlinePencil,
  HiOutlineTrash,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeDueDate, priorityMeta } from "@/lib/todo-utils";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TodoItemProps {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

const dueStyles = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-foreground",
  soon: "text-muted-foreground",
  later: "text-muted-foreground",
};

export function TodoItem({ todo, onToggle, onEdit, onDelete }: TodoItemProps) {
  const priority = priorityMeta(todo.priority);
  const due = todo.dueDate ? describeDueDate(todo.dueDate) : null;
  // The checkbox outline already carries the priority colour; only spell out High
  const showPriority = todo.priority === "HIGH" && !todo.completed;
  const hasMeta = Boolean(due) || showPriority;

  return (
    <li className="group flex items-start gap-4 py-4">
      <Checkbox
        checked={todo.completed}
        onCheckedChange={() => onToggle(todo)}
        aria-label={todo.completed ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
        className={cn(
          "mt-0.5 size-[22px] rounded-full border-[1.5px] bg-transparent dark:bg-transparent [&_svg]:size-4",
          !todo.completed && priority.ring,
          "data-checked:border-muted-foreground/60 data-checked:bg-muted-foreground/60 dark:data-checked:bg-muted-foreground/60",
        )}
      />

      <button
        type="button"
        onClick={() => onEdit(todo)}
        className="min-w-0 flex-1 cursor-pointer rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <p
          className={cn(
            "text-base leading-[1.625rem] break-words",
            todo.completed && "text-muted-foreground line-through decoration-muted-foreground/50",
          )}
        >
          {todo.title}
        </p>
        {todo.description && !todo.completed && (
          <p className="mt-0.5 line-clamp-2 text-[0.9375rem] leading-6 text-muted-foreground">{todo.description}</p>
        )}
        {hasMeta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  todo.completed ? "text-muted-foreground" : dueStyles[due.state],
                )}
              >
                <HiOutlineCalendar className="size-4" />
                {due.label}
              </span>
            )}
            {showPriority && (
              <span className={cn("inline-flex items-center gap-1", priority.text)}>
                <HiOutlineFlag className="size-4" />
                {priority.label}
              </span>
            )}
          </div>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for "${todo.title}"`}
              className="-mr-2 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100"
            />
          }
        >
          <HiOutlineEllipsisHorizontal className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem className="py-2 text-[0.9375rem]" onClick={() => onEdit(todo)}>
            <HiOutlinePencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="py-2 text-[0.9375rem]" variant="destructive" onClick={() => onDelete(todo)}>
            <HiOutlineTrash />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
