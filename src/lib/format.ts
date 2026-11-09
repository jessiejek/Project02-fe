/**
 * Display formatting shared by the admin, staff and patient portals.
 * Clinic dates on the wire are `YYYY-MM-DD` clinic (Manila) dates, so they are
 * formatted as calendar dates in UTC: no viewer-timezone shift is possible.
 */
const DATE_FMT = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });
const DATE_SHORT_FMT = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const DATETIME_FMT = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function parseClinicDate(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Mon, Nov 9, 2026" for a clinic date; the fallback when it is missing or malformed. */
export function formatClinicDate(value: string | null | undefined, fallback = "—"): string {
  const d = parseClinicDate(value);
  return d ? DATE_FMT.format(d) : fallback;
}

/** "Nov 9, 2026" for a clinic date. */
export function formatClinicDateShort(value: string | null | undefined, fallback = "—"): string {
  const d = parseClinicDate(value);
  return d ? DATE_SHORT_FMT.format(d) : fallback;
}

/** An instant (ISO timestamp) shown in clinic time: "Nov 9, 2026, 1:05 PM". */
export function formatClinicDateTime(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : DATETIME_FMT.format(d);
}

/** "9:05 AM" from "HH:mm" or "HH:mm:ss"; the fallback when it is missing. */
export function formatClockTime(value: string | null | undefined, fallback = "—"): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!m) return fallback;
  const h = Number(m[1]);
  if (h > 23) return fallback;
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/** "₱1,250" (centavos only when present); the fallback for missing/non-finite values. */
export function formatPeso(value: number | string | null | undefined, fallback = "—"): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return fallback;
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Empty strings render as an em dash, never as a blank cell. */
export function orDash(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}
