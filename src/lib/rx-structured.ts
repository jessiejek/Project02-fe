//JJQR - AI (Nov 20, 2026)
/**
 * Deterministic Rx structured-field helpers for the paper-pad entry UI.
 * Parser suggestions only fill fields the doctor has not set. No I/O, no DOM.
 */
import { parseRxSig } from "./rx-sig-parse.ts";

export const RX_SLOT_LABELS = ["Breakfast", "Lunch", "Dinner", "Bedtime"] as const;

const SLOT_FROM_PARSE: { [k: string]: string } = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  BEDTIME: "Bedtime",
};

function isEmptyTiming(timing: string | null | undefined): boolean {
  return !(timing && String(timing).trim());
}

export function timingToSlots(timing: string | null | undefined): string[] {
  const raw = (timing ?? "").trim();
  if (!raw) return [];
  const seen: { [k: string]: boolean } = {};
  const parts = raw.split(",");
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim().toLowerCase();
    for (let j = 0; j < RX_SLOT_LABELS.length; j++) {
      if (RX_SLOT_LABELS[j].toLowerCase() === p) seen[RX_SLOT_LABELS[j]] = true;
    }
  }
  const out: string[] = [];
  for (let i = 0; i < RX_SLOT_LABELS.length; i++) {
    if (seen[RX_SLOT_LABELS[i]]) out.push(RX_SLOT_LABELS[i]);
  }
  return out;
}

export function slotsToTiming(slots: string[]): string | null {
  const seen: { [k: string]: boolean } = {};
  for (let i = 0; i < slots.length; i++) seen[slots[i]] = true;
  const out: string[] = [];
  for (let i = 0; i < RX_SLOT_LABELS.length; i++) {
    if (seen[RX_SLOT_LABELS[i]]) out.push(RX_SLOT_LABELS[i]);
  }
  return out.length ? out.join(", ") : null;
}

export function suggestFromSig(input: {
  instruction?: string | null;
  route?: string | null;
}): { meal: "Before" | "After" | null; slots: string[]; asNeeded: boolean } {
  const parsed = parseRxSig({ instruction: input.instruction, route: input.route });
  const meal = parsed.meal === "before" ? "Before" : parsed.meal === "after" ? "After" : null;
  const slots: string[] = [];
  for (let i = 0; i < parsed.slots.length; i++) {
    const label = SLOT_FROM_PARSE[parsed.slots[i]];
    if (label) slots.push(label);
  }
  return { meal: meal, slots: slots, asNeeded: parsed.asNeeded };
}

export function prefillItem<
  T extends {
    instruction?: string | null;
    route?: string | null;
    mealRelation?: "Before" | "After" | null;
    timing?: string | null;
    asNeeded?: boolean | null;
  },
>(item: T): T {
  const suggested = suggestFromSig({ instruction: item.instruction, route: item.route });
  const next: T = { ...item };
  if (item.mealRelation == null) next.mealRelation = suggested.meal;
  if (item.asNeeded == null) next.asNeeded = suggested.asNeeded;
  const timingEmpty = isEmptyTiming(item.timing);
  if (timingEmpty && next.asNeeded !== true) {
    next.timing = slotsToTiming(suggested.slots);
  }
  return next;
}

export function asNeededFromWire(v: boolean | null | undefined): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export function asNeededToWire(v: boolean | null | undefined): boolean | null {
  return typeof v === "boolean" ? v : null;
}
//JJQR - END
