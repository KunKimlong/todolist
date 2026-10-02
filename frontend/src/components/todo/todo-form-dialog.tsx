"use client";

import { useState } from "react";
import { BiLoaderAlt } from "react-icons/bi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/date-picker";
import { PrioritySelect } from "./priority-select";
import type { Priority, Todo, TodoInput } from "@/lib/types";

export type TodoDialogState = { mode: "create" } | { mode: "edit"; todo: Todo } | null;

interface TodoFormDialogProps {
  state: TodoDialogState;
  onClose: () => void;
  onCreate: (input: TodoInput) => Promise<boolean>;
  onUpdate: (id: number, input: TodoInput) => Promise<boolean>;
}

export function TodoFormDialog({ state, onClose, onCreate, onUpdate }: TodoFormDialogProps) {
  const todo = state?.mode === "edit" ? state.todo : null;

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        {/* Keyed so the form state resets every time the dialog opens for a different task */}
        {state && (
          <TodoForm
            key={todo ? `edit-${todo.id}` : "create"}
            todo={todo}
            onCancel={onClose}
            onSubmit={(input) => (todo ? onUpdate(todo.id, input) : onCreate(input))}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const labelClass = "text-sm font-medium";
const fieldClass = "h-10 px-3 text-[0.9375rem] md:text-[0.9375rem]";

function TodoForm({
  todo,
  onSubmit,
  onCancel,
}: {
  todo: Todo | null;
  onSubmit: (input: TodoInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const isEdit = todo !== null;
  const [title, setTitle] = useState(todo?.title ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? "");
  const [completed, setCompleted] = useState(todo?.completed ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    const ok = await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      dueDate: dueDate || null,
      completed,
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader className="px-6 pt-6 pb-2">
        <DialogTitle className="text-lg">{isEdit ? "Edit task" : "New task"}</DialogTitle>
        <DialogDescription className="sr-only">
          {isEdit ? "Update the details of this task." : "Add a task to your list."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 px-6 py-4">
        <div className="grid gap-2">
          <Label htmlFor="todo-title" className={labelClass}>
            Title
          </Label>
          <Input
            id="todo-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            maxLength={200}
            className={fieldClass}
            autoFocus
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="todo-description" className={labelClass}>
            Notes
          </Label>
          <Textarea
            id="todo-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Optional"
            className="min-h-24 px-3 py-2 text-[0.9375rem] md:text-[0.9375rem]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="todo-priority" className={labelClass}>
              Priority
            </Label>
            <PrioritySelect id="todo-priority" value={priority} onChange={setPriority} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="todo-due" className={labelClass}>
              Due date
            </Label>
            <DatePicker id="todo-due" value={dueDate} onChange={setDueDate} placeholder="No due date" />
          </div>
        </div>

        {isEdit && (
          <Label className="flex w-fit cursor-pointer items-center gap-2.5 text-[0.9375rem] font-normal">
            <Checkbox
              checked={completed}
              onCheckedChange={(checked) => setCompleted(checked)}
              className="size-[18px]"
            />
            Mark as completed
          </Label>
        )}
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <Button type="button" variant="outline" size="lg" className="h-10 px-4" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="h-10 px-4" disabled={!title.trim() || saving}>
          {saving && <BiLoaderAlt className="animate-spin" />}
          {isEdit ? "Save" : "Add task"}
        </Button>
      </DialogFooter>
    </form>
  );
}
