export type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface Todo {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  priority: Priority;
  dueDate: string | null; // yyyy-MM-dd
  createdAt: string;
  updatedAt: string;
}

export interface TodoInput {
  title: string;
  description?: string | null;
  priority: Priority;
  dueDate?: string | null;
  completed?: boolean;
}

export type TodoFilter = "all" | "active" | "completed";
