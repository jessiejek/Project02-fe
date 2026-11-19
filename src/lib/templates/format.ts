//JJQR - AI (Nov 19, 2026) - pure display helpers for the templates workspace (Mine-first sort, copy naming, Rx sig in normal case, phrase-name auto-fill)

/** "AMOXICILLIN 500MG" -> "Amoxicillin 500mg". Text that already has lowercase letters is left alone. */
export function normalCase(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  if (t !== t.toUpperCase()) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export interface SigInput {
  generic_name: string;
  dosage?: string | null;
  quantity?: string | null;
  instruction?: string | null;
  timing?: string | null;
  meal_relation?: string | null;
  duration_kind?: string | null;
  duration_value?: number | null;
}

/** "Amoxicillin 500 mg — 3 times a day, after meals · 7 days" (drug, dose, frequency, duration; normal case). */
export function rxSig(i: SigInput): string {
  const name = normalCase(i.generic_name);
  const dose = normalCase(i.dosage);
  const meal = i.meal_relation ? `${i.meal_relation.toLowerCase()} meals` : "";
  const frequency = [normalCase(i.instruction), normalCase(i.timing), meal].filter(Boolean).join(", ");
  const duration = i.duration_kind === "Maintain" ? "maintenance" : i.duration_kind && i.duration_value ? `${i.duration_value} ${i.duration_kind.toLowerCase()}` : "";
  const head = [name, dose].filter(Boolean).join(" ");
  const tail = [frequency, duration].filter(Boolean).join(" · ");
  return tail ? `${head} — ${tail}` : head;
}

/** Mine first, then System; A-Z inside each group. Returns a new array. */
export function sortMineFirst<T>(items: readonly T[], isSystem: (t: T) => boolean, title: (t: T) => string): T[] {
  return items.slice().sort((a, b) => Number(isSystem(a)) - Number(isSystem(b)) || title(a).localeCompare(title(b)));
}

export const COPY_PREFIX = "Copy of ";
export const isCopyTitle = (title: string) => title.startsWith(COPY_PREFIX);

/** "Copy of X", then "Copy of X (2)", ... so a duplicate never looks like the original. */
export function copyTitle(title: string, existing: readonly string[]): string {
  const base = isCopyTitle(title) ? title : `${COPY_PREFIX}${title}`;
  const taken = new Set(existing.map((t) => t.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n++) if (!taken.has(`${base} (${n})`.toLowerCase())) return `${base} (${n})`;
  return `${base} (${Date.now()})`;
}

/** First few words of the text, as a phrase name (max 5 words / 40 chars, trailing punctuation dropped). */
export function phraseNameFromText(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
  const clipped = words.length > 40 ? words.slice(0, 40).replace(/\s+\S*$/, "") || words.slice(0, 40) : words;
  const name = clipped.replace(/[\s.,;:\-–—]+$/, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
//JJQR - END
