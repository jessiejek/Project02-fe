//JJQR - AI (2026-11-25) - why: GAV-4 (owner approved the pro mockup): patients left Waiting / On hold / In consultation on an EARLIER day used to
// vanish from every Today screen at midnight. They are listed under "⚠ Not finished on an earlier day", one group per visit date (Manila), the most
// recent date open and older dates closed. Plain module (no imports) so node:test can check it (leftover-queue.test.mjs). Same rules as the desktop's
// LeftoverGroups.cs.
export const LEFTOVER_DAYS_BACK = 30;

export interface LeftoverEntry {
  booking_id: string;
  appointment_date: string; // YYYY-MM-DD (Manila)
  queue_number: string;
  is_priority?: boolean;
  patient_id: string;
  patient_name: string;
  patient_code: string;
  doctor_id: string;
  status: string; // CheckedIn | OnHold | InProgress
  visit_type: "New" | "FollowUp";
  amount_due: number;
  checked_in_at: string;
  updated_at: string;
  is_walk_in: boolean;
}

export interface LeftoverGroup {
  date: string;
  header: string; // "Tue, Nov 24"
  countLabel: string; // "2 patients"
  chip: string; // "Nov 24"
  items: LeftoverEntry[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LIVE = new Set(["CheckedIn", "OnHold", "InProgress"]);

export function patientsLabel(n: number): string {
  return `${n} patient${n === 1 ? "" : "s"}`;
}

/** "2026-11-24" -> "Nov 24" (year added when it is not this year's). */
export function leftoverChip(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const s = `${MONTHS[m - 1]} ${d}`;
  return date.slice(0, 4) === today.slice(0, 4) ? s : `${s}, ${y}`;
}

/** "2026-11-24" -> "Tue, Nov 24". */
export function leftoverDay(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${leftoverChip(date, today)}`;
}

/** Earlier days only (before today, within LEFTOVER_DAYS_BACK), live statuses only, newest date first; inside a date priority lane then arrival. */
export function groupLeftovers(items: LeftoverEntry[], today: string): LeftoverGroup[] {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - LEFTOVER_DAYS_BACK));
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  const byDate = new Map<string, LeftoverEntry[]>();
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.appointment_date || it.appointment_date >= today || it.appointment_date < from || !LIVE.has(it.status) || seen.has(it.booking_id)) continue;
    seen.add(it.booking_id);
    byDate.set(it.appointment_date, [...(byDate.get(it.appointment_date) ?? []), it]);
  }
  return [...byDate.keys()].sort().reverse().map((date) => {
    const rows = byDate.get(date)!.slice().sort((a, b) =>
      Number(!!b.is_priority) - Number(!!a.is_priority) || (a.checked_in_at ?? "").localeCompare(b.checked_in_at ?? ""));
    return { date, header: leftoverDay(date, today), countLabel: patientsLabel(rows.length), chip: leftoverChip(date, today), items: rows };
  });
}

export function leftoverTotal(groups: LeftoverGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}

/** The most recent date is open, older ones closed; the user's own toggle wins. */
export function isLeftoverOpen(groups: LeftoverGroup[], date: string, toggled: Record<string, boolean>): boolean {
  if (date in toggled) return toggled[date];
  return groups[0]?.date === date;
}

function manilaTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(t);
}

/** Status pill text and the small "since …" line under it. */
export function leftoverStatus(e: LeftoverEntry, today: string): { pill: string; since: string } {
  const chip = leftoverChip(e.appointment_date, today);
  if (e.status === "InProgress") {
    const time = manilaTime(e.updated_at);
    return { pill: "In progress", since: `since ${chip}${time ? ` ${time}` : ""}` };
  }
  return { pill: e.status === "OnHold" ? "On hold" : "Waiting", since: `since ${chip}` };
}

export const LEFTOVER_OLD_SERVER = "Moving a patient to today needs the updated clinic server.";
export const LEFTOVER_GENERIC = "That didn't go through. Check the connection and try again.";
export function leftoverErrorText(status: number | undefined, body: unknown): string {
  const message = body && typeof body === "object" && typeof (body as Record<string, unknown>).message === "string" ? ((body as Record<string, unknown>).message as string).trim() : "";
  if (message) return message;
  if (status === 404 || status === 405) return LEFTOVER_OLD_SERVER;
  if (status === 403) return "Only this visit's own doctor or the front desk can change it.";
  return LEFTOVER_GENERIC;
}
//JJQR - END
