"use client";

import { HiOutlineMagnifyingGlass, HiOutlineXMark } from "react-icons/hi2";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import {
  DATE_FILTER_LABELS,
  PRIORITIES,
  SORT_LABELS,
  type DateFilter,
  type SortKey,
} from "@/lib/todo-utils";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Filters {
  query: string;
  priority: Priority | "ALL";
  date: DateFilter;
  specificDate: string;
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  priority: "ALL",
  date: "any",
  specificDate: "",
};

export function hasActiveFilters(filters: Filters) {
  return filters.query.trim() !== "" || filters.priority !== "ALL" || filters.date !== "any";
}

const PRIORITY_FILTER_LABELS: Record<Filters["priority"], string> = {
  ALL: "Any priority",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const DATE_TRIGGER_LABELS: Record<DateFilter, string> = {
  ...DATE_FILTER_LABELS,
  any: "Any date",
  specific: "On date",
};

const SORT_TRIGGER_LABELS: Record<SortKey, string> = {
  newest: "Sort: Newest",
  priority: "Sort: Priority",
  dueDate: "Sort: Due date",
};

const triggerClass =
  "px-2 sm:px-3 text-[0.9375rem] text-muted-foreground border-transparent bg-transparent shadow-none data-[size=default]:h-10 hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted data-popup-open:bg-muted";
const activeTriggerClass = "bg-muted text-foreground dark:bg-muted";
const itemClass = "py-2 pl-2.5 text-[0.9375rem]";

interface TodoFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
}

export function TodoFilters({ filters, onChange, sort, onSortChange }: TodoFiltersProps) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <div className="relative min-w-0 flex-1 basis-full sm:basis-60">
        <HiOutlineMagnifyingGlass className="pointer-events-none absolute top-1/2 left-0 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Search tasks"
          aria-label="Search tasks by name"
          className="h-10 rounded-none border-0 bg-transparent pr-8 pl-8 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
        />
        {filters.query && (
          <button
            type="button"
            onClick={() => set("query", "")}
            aria-label="Clear search"
            className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HiOutlineXMark className="size-4" />
          </button>
        )}
      </div>

      <div className="-ml-2 flex flex-wrap items-center gap-0.5 sm:ml-0 sm:gap-1">
        <Select
          value={filters.priority}
          items={PRIORITY_FILTER_LABELS}
          onValueChange={(v) => v && set("priority", v as Filters["priority"])}
        >
          <SelectTrigger
            aria-label="Filter by priority"
            className={cn(triggerClass, filters.priority !== "ALL" && activeTriggerClass)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start">
            <SelectItem value="ALL" className={itemClass}>
              Any priority
            </SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value} className={itemClass}>
                <span className={cn("size-2 shrink-0 self-center rounded-full", p.dot)} />
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.date}
          items={DATE_TRIGGER_LABELS}
          onValueChange={(v) => v && set("date", v as DateFilter)}
        >
          <SelectTrigger
            aria-label="Filter by due date"
            className={cn(triggerClass, filters.date !== "any" && activeTriggerClass)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start">
            {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((key) => (
              <SelectItem key={key} value={key} className={itemClass}>
                {key === "any" ? "Any date" : DATE_FILTER_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filters.date === "specific" && (
          <DatePicker
            value={filters.specificDate}
            onChange={(v) => set("specificDate", v)}
            placeholder="Choose date"
            aria-label="Due on date"
            shortcuts={false}
            className="w-44"
          />
        )}

        <Select
          value={sort}
          items={SORT_TRIGGER_LABELS}
          onValueChange={(v) => v && onSortChange(v as SortKey)}
        >
          <SelectTrigger aria-label="Sort tasks" className={triggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="end">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <SelectItem key={key} value={key} className={itemClass}>
                {SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
