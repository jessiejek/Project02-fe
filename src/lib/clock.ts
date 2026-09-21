/**
 * §17.1 #3 — the clinic runs in Asia/Manila (UTC+8, no DST). `new Date().toISOString()
 * .slice(0, 10)` is the UTC date, so between 00:00–08:00 PHT every "today" query lands
 * on yesterday. This module is the ONLY place the client turns an instant into a clinic
 * date — use it instead of `toISOString().slice(...)` (a unit test enforces that).
 *
 * Keep this file free of TypeScript-only syntax (enums, parameter properties): the unit
 * tests load it directly with Node's built-in type stripping.
 *
 * The BE mirror is `ClinicApp.Domain.ClinicClock` (Project02-be). Dates on the wire are
 * `YYYY-MM-DD` clinic dates; never send a UTC-derived date to the API as "today".
 */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` for "now" (or the given epoch-ms instant) in Manila. */
export function todayManila(now: number = Date.now()): string {
  return new Date(now + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` for a given Date, in Manila. */
export function toManilaDate(d: Date): string {
  return todayManila(d.getTime());
}

/** `YYYY-MM` for the current Manila month. */
export function currentMonthManila(now: number = Date.now()): string {
  return todayManila(now).slice(0, 7);
}

/** Calendar arithmetic on a `YYYY-MM-DD` date. No timezone is involved, so it is DST/locale-proof. */
export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The Manila date `days` from now (negative = past). */
export function daysFromTodayManila(days: number, now: number = Date.now()): string {
  return addDaysToDate(todayManila(now), days);
}

/** `YYYY-MM` of the month before the given `YYYY-MM`. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/**
 * A local-time `Date` at midnight of Manila's current calendar day — for calendar widgets that
 * work in the browser's local zone (week grids, "today" highlight) but must agree with the clinic's
 * date rather than the visitor's.
 */
export function manilaTodayAsLocalDate(now: number = Date.now()): Date {
  const [y, m, d] = todayManila(now).split("-").map(Number);
  return new Date(y, m - 1, d);
}
