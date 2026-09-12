"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export interface DatePickerProps {
  /** ISO "YYYY-MM-DD", or "" for no selection. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** ISO "YYYY-MM-DD" — days before this are shown but not selectable. */
  minDate?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseISO(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function isSameDay(a: Date, b: Date | null): boolean {
  return !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatDisplay(value: string): string {
  const date = parseISO(value);
  if (!date) return "";
  return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Custom calendar dropdown replacing the browser's native `<input type="date">`
 * popup (OS-styled, inconsistent with the rest of the app) with one built from
 * the same design tokens as every other control.
 */
export function DatePicker({ value, onChange, placeholder = "Select date", disabled, className, minDate }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [viewDate, setViewDate] = useState(selected ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function togglePicker() {
    if (disabled) return;
    setViewDate(selected ?? new Date());
    setOpen((o) => !o);
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }

  const minD = minDate ? parseISO(minDate) : null;
  const today = new Date();

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={togglePicker}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-sm rounded-lg border border-outline-variant bg-surface px-md py-sm text-left text-body-md transition-colors",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/60",
          open && "border-primary ring-2 ring-primary/20",
        )}
      >
        <span className={value ? "text-on-surface" : "text-on-surface-variant"}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <Icon name="calendar_today" className="text-[18px] text-on-surface-variant" />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-xs w-[min(280px,calc(100vw-2rem))] rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-lg">
          <div className="mb-sm flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              aria-label="Previous month"
              className="rounded-full p-xs text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <Icon name="chevron_left" className="text-[18px]" />
            </button>
            <span className="text-label-md font-medium text-on-surface">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              aria-label="Next month"
              className="rounded-full p-xs text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-label-sm text-on-surface-variant">
            {WEEKDAY_LABELS.map((d) => (
              <span key={d} className="py-1">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }, i) => {
              const isSelected = isSameDay(date, selected);
              const isToday = isSameDay(date, today);
              const isDisabled = !!minD && date < minD;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(toISO(date));
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-full py-1 text-label-md transition-colors",
                    !inMonth && "text-on-surface-variant/40",
                    inMonth && !isSelected && "text-on-surface hover:bg-surface-container-high",
                    isSelected && "bg-primary font-medium text-on-primary",
                    !isSelected && isToday && "border border-primary text-primary",
                    isDisabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(toISO(today));
              setOpen(false);
            }}
            className="mt-sm w-full rounded-lg py-xs text-center text-label-md text-primary hover:bg-surface-container-high"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
