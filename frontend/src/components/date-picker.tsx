"use client";

import { useState } from "react";
import { addDays, format, isValid, nextMonday, parseISO, startOfToday } from "date-fns";
import { HiOutlineCalendar, HiOutlineXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { describeDueDate } from "@/lib/todo-utils";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** Selected date as yyyy-MM-dd, or "" for none */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
  /** Show the Today / Tomorrow / Next week shortcuts */
  shortcuts?: boolean;
}

const toValue = (date: Date) => format(date, "yyyy-MM-dd");

function toDate(value: string) {
  if (!value) return undefined;
  // parseISO treats a date-only string as local midnight, so no timezone drift
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

/** "Today", "Tomorrow", or e.g. "Fri, Oct 9" — friendlier than a raw date */
function displayLabel(value: string) {
  const date = toDate(value);
  if (!date) return "";
  const relative = describeDueDate(value).label;
  if (relative === "Today" || relative === "Tomorrow" || relative === "Yesterday") return relative;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "EEE, MMM d" : "EEE, MMM d, yyyy");
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  className,
  "aria-label": ariaLabel,
  shortcuts = true,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  function pick(date: Date | undefined) {
    onChange(date ? toValue(date) : "");
    setOpen(false);
  }

  const today = startOfToday();
  const quickPicks = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "Next week", date: nextMonday(today) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant="outline"
              aria-label={ariaLabel}
              className={cn(
                "h-10 w-full justify-start gap-2 px-3 text-left text-[0.9375rem] font-normal",
                !selected && "text-muted-foreground",
                selected && "pr-9",
              )}
            />
          }
        >
          <HiOutlineCalendar className="size-[18px] text-muted-foreground" />
          <span className="truncate">{selected ? displayLabel(value) : placeholder}</span>
        </PopoverTrigger>
        {selected && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear date"
            className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HiOutlineXMark className="size-4" />
          </button>
        )}
      </div>

      <PopoverContent align="start" className="w-[19rem] gap-0 p-0">
        {shortcuts && (
          <div className="grid grid-cols-4 gap-1 border-b p-2">
            {quickPicks.map((q) => (
              <Button
                key={q.label}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => pick(q.date)}
                className={cn(
                  "h-8 px-1 text-[0.8125rem]",
                  value === toValue(q.date) && "bg-muted text-foreground",
                )}
              >
                {q.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => pick(undefined)}
              className="h-8 px-1 text-[0.8125rem] text-muted-foreground"
            >
              No date
            </Button>
          </div>
        )}
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? today}
          onSelect={(date) => pick(date)}
          weekStartsOn={1}
          className="mx-auto p-3 [--cell-size:--spacing(10)]"
        />
      </PopoverContent>
    </Popover>
  );
}
