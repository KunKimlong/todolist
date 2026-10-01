import type { Priority, Todo } from "./types";

export const PRIORITIES: {
  value: Priority;
  label: string;
  /** Small swatch used in pickers */
  dot: string;
  /** Text colour for the priority label in a task row */
  text: string;
  /** Checkbox outline tint, so priority reads at a glance without extra badges */
  ring: string;
}[] = [
  {
    value: "HIGH",
    label: "High",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    ring: "border-red-500/80 dark:border-red-400/80",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    ring: "border-amber-500/80 dark:border-amber-400/80",
  },
  {
    value: "LOW",
    label: "Low",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    ring: "border-muted-foreground/40",
  },
];

export const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function priorityMeta(priority: Priority) {
  return PRIORITIES.find((p) => p.value === priority) ?? PRIORITIES[1];
}

const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export type SortKey = "newest" | "priority" | "dueDate";

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  priority: "Priority",
  dueDate: "Due date",
};

export type DateFilter = "any" | "overdue" | "today" | "tomorrow" | "week" | "none" | "specific";

export const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  any: "Any due date",
  overdue: "Overdue",
  today: "Due today",
  tomorrow: "Due tomorrow",
  week: "Next 7 days",
  none: "No due date",
  specific: "Specific date…",
};

/** Whether a todo matches the due-date filter. Dates are compared as yyyy-MM-dd strings. */
export function matchesDateFilter(todo: Todo, filter: DateFilter, specificDate: string): boolean {
  if (filter === "any") return true;
  if (filter === "none") return !todo.dueDate;
  if (filter === "specific") return !specificDate || todo.dueDate === specificDate;
  if (!todo.dueDate) return false;

  const today = todayString();
  switch (filter) {
    case "overdue":
      return !todo.completed && todo.dueDate < today;
    case "today":
      return todo.dueDate === today;
    case "tomorrow":
      return todo.dueDate === addDays(1);
    case "week":
      return todo.dueDate >= today && todo.dueDate <= addDays(7);
  }
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

export function sortTodos(todos: Todo[], sort: SortKey): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (sort === "priority" && a.priority !== b.priority) {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    if (sort === "dueDate" && a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayString() {
  return toLocalDateString(new Date());
}

export type DueState = "overdue" | "today" | "soon" | "later";

export function describeDueDate(dueDate: string): { label: string; state: DueState } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return { label: diffDays === -1 ? "Yesterday" : `${-diffDays} days overdue`, state: "overdue" };
  }
  if (diffDays === 0) return { label: "Today", state: "today" };
  if (diffDays === 1) return { label: "Tomorrow", state: "soon" };

  const label = due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(due.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
  return { label, state: diffDays <= 7 ? "soon" : "later" };
}
