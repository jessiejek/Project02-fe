"use client";

//JJQR - AI (Nov 20, 2026)
import { cn } from "@/lib/cn";
import { RX_SLOT_LABELS } from "@/lib/rx-structured";

type Meal = "Before" | "After" | null;

interface RxTimingFieldsProps {
  meal: Meal;
  slots: string[];
  asNeeded: boolean;
  onMeal: (m: Meal) => void;
  onSlots: (slots: string[]) => void;
  onAsNeeded: (b: boolean) => void;
  idPrefix?: string;
}

const MEALS: Array<Exclude<Meal, null>> = ["Before", "After"];

function pillClass(on: boolean) {
  return cn(
    "min-h-[44px] min-w-[44px] whitespace-nowrap rounded-lg border px-md py-sm text-label-md",
    on ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant",
  );
}

export function RxTimingFields({
  meal,
  slots,
  asNeeded,
  onMeal,
  onSlots,
  onAsNeeded,
  idPrefix = "rx-timing",
}: RxTimingFieldsProps) {
  function toggleSlot(label: string) {
    const next = slots.includes(label) ? slots.filter((s) => s !== label) : [...slots, label];
    onSlots(RX_SLOT_LABELS.filter((l) => next.includes(l)));
  }

  return (
    <div className="space-y-md">
      <div>
        <p className="mb-xs text-label-sm text-on-surface-variant">Meal timing</p>
        <div className="flex flex-wrap gap-sm">
          {MEALS.map((option) => (
            <button
              key={option}
              id={`${idPrefix}-meal-${option.toLowerCase()}`}
              type="button"
              onClick={() => onMeal(meal === option ? null : option)}
              aria-pressed={meal === option}
              className={pillClass(meal === option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-xs text-label-sm text-on-surface-variant">Times</p>
        <div className="flex flex-wrap gap-sm">
          {RX_SLOT_LABELS.map((slot) => (
            <button
              key={slot}
              id={`${idPrefix}-slot-${slot.toLowerCase()}`}
              type="button"
              onClick={() => toggleSlot(slot)}
              aria-pressed={slots.includes(slot)}
              className={pillClass(slots.includes(slot))}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-sm">
        <button
          id={`${idPrefix}-as-needed`}
          type="button"
          onClick={() => onAsNeeded(!asNeeded)}
          aria-pressed={asNeeded}
          className={pillClass(asNeeded)}
        >
          As needed
        </button>
      </div>
    </div>
  );
}
//JJQR - END
