"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/todo-utils";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PrioritySelectProps {
  value: Priority;
  onChange: (value: Priority) => void;
  className?: string;
  id?: string;
}

export function PrioritySelect({ value, onChange, className, id }: PrioritySelectProps) {
  return (
    <Select
      value={value}
      items={PRIORITY_LABELS}
      onValueChange={(next) => next && onChange(next as Priority)}
    >
      <SelectTrigger
        id={id}
        aria-label="Priority"
        className={cn("w-full px-3 text-[0.9375rem] data-[size=default]:h-10", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((p) => (
          <SelectItem key={p.value} value={p.value} className="py-2 pl-2.5 text-[0.9375rem]">
            <span className={cn("size-2 shrink-0 self-center rounded-full", p.dot)} />
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
