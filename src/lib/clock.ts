/**
 * §17.1 #3 — the clinic runs in Asia/Manila (UTC+8, no DST). `new Date()
 * .toISOString().slice(0,10)` gives the UTC date, so between 00:00–08:00 PHT
 * every "today" query lands on yesterday. Use these instead.
 */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** `YYYY-MM-DD` for "now" in Manila. */
export function todayManila(): string {
  return new Date(Date.now() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` for a given Date, in Manila. */
export function toManilaDate(d: Date): string {
  return new Date(d.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}
