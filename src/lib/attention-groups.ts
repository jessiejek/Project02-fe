//JJQR - AI (Nov 25, 2026) - owner (GAV-2, approved mockup): the doctor dashboard's "Needs attention" is grouped by the visit date. "Today · Nov 25" comes first
// and is open; each older date ("Nov 24 · 2 items") is a header that opens / closes. Items that were not cleared on an earlier day stay under their own date
// (looked back ATTENTION_DAYS_BACK days). Dates are clinic (Manila) dates "YYYY-MM-DD". Same rules as the desktop's AttentionGroups.cs.
// Plain module (no imports) so node:test can check it (attention-groups.test.mjs).
export const ATTENTION_DAYS_BACK = 30;
export const ATTENTION_GROUP_MAX_ROWS = 8;

export type AttentionKind = "unpaid" | "chart" | "followup";

export interface AttentionEntry {
  key: string;
  kind: AttentionKind;
  date: string; // YYYY-MM-DD (Manila)
  name: string;
  what: string;
  note: string;
  action: string;
  href: string;
}

export interface AttentionGroup {
  date: string;
  isToday: boolean;
  header: string;
  countLabel: string;
  items: AttentionEntry[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KIND_ORDER: Record<AttentionKind, number> = { unpaid: 0, chart: 1, followup: 2 };

/** "2026-11-24" -> "Nov 24" (the year is added when it is not this year). */
export function shortDate(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const s = `${MONTHS[m - 1]} ${d}`;
  return date.slice(0, 4) === today.slice(0, 4) ? s : `${s}, ${y}`;
}

export function itemsLabel(n: number): string {
  return `${n} item${n === 1 ? "" : "s"}`;
}

/** The first date still shown: today minus ATTENTION_DAYS_BACK (plain calendar math on the Manila date). */
export function attentionFrom(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - ATTENTION_DAYS_BACK));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Groups by date: today first, then older dates newest first; unpaid, then charts, then follow-ups inside a date. Future and too-old dates are dropped. */
export function groupAttention(items: AttentionEntry[], today: string): AttentionGroup[] {
  const from = attentionFrom(today);
  const byDate = new Map<string, AttentionEntry[]>();
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.date || it.date > today || it.date < from || seen.has(it.key)) continue;
    seen.add(it.key);
    const list = byDate.get(it.date) ?? [];
    list.push(it);
    byDate.set(it.date, list);
  }
  return [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const list = byDate.get(date)!.slice().sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
      const isToday = date === today;
      return {
        date,
        isToday,
        header: isToday ? `Today · ${shortDate(date, today)}` : shortDate(date, today),
        countLabel: itemsLabel(list.length),
        items: list,
      };
    });
}

/** Today is open unless the doctor closed it; older dates are closed unless she opened them. */
export function isGroupOpen(group: { date: string; isToday: boolean }, toggled: Record<string, boolean>): boolean {
  return toggled[group.date] ?? group.isToday;
}
//JJQR - END
