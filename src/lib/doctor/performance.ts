//JJQR - AI (Nov 19, 2026) - NEW: pure helpers for the doctor's Performance page (percent change, greeting, cheerful wording, peso, chart geometry).
// No imports from the app (only `import type`): the unit tests load this file directly with Node's type stripping,
// and nothing here reads the clock or the DOM — everything takes its inputs, so it is deterministic.
import type { DoctorPerformance, PerformanceDay, PerformancePeriodName, PerformanceStats } from "@/lib/data/doctor-performance";

export const PERIOD_OPTIONS: { id: PerformancePeriodName; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

/** What the previous period is called in a sentence: "vs yesterday". */
export const PREVIOUS_LABEL: Record<PerformancePeriodName, string> = {
  today: "yesterday",
  week: "last week",
  month: "last month",
};

/** "today" / "this week" / "this month" for use inside a sentence. */
export const PERIOD_PHRASE: Record<PerformancePeriodName, string> = {
  today: "today",
  week: "this week",
  month: "this month",
};

export function isPeriod(value: string | null | undefined): value is PerformancePeriodName {
  return value === "today" || value === "week" || value === "month";
}

// ── money ──────────────────────────────────────────────────────────────
/** "₱1,250" (centavos only when present). Missing / non-finite → "₱0" so a card never reads "NaN". */
export function pesoLabel(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Short form for chart axes: ₱950, ₱1.2k, ₱12k, ₱1.5M. */
export function pesoCompact(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  if (n >= 1_000_000) return `₱${trim(n / 1_000_000)}M`;
  if (n >= 10_000) return `₱${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `₱${trim(n / 1000)}k`;
  return `₱${Math.round(n)}`;
}
function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// ── change vs the previous period ──────────────────────────────────────
export type ChangeDirection = "up" | "down" | "flat" | "new";
export interface Change {
  direction: ChangeDirection;
  /** Whole percent, absolute (the arrow carries the sign). null for "new" / "flat". */
  percent: number | null;
  /** Ready-to-show text, e.g. "↑ 12% vs yesterday". Never alarming. */
  text: string;
  /** "positive" = green, "soft" = quiet grey (a dip), "neutral" = grey. Never red. */
  tone: "positive" | "soft" | "neutral";
}

/** Percent change from `previous` to `current`, rounded. null when there is no baseline (previous is 0). */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function describeChange(current: number, previous: number, previousLabel: string): Change {
  const cur = Number.isFinite(current) ? current : 0;
  const prev = Number.isFinite(previous) ? previous : 0;
  if (cur === prev) {
    return cur === 0
      ? { direction: "flat", percent: null, text: `Nothing yet — same as ${previousLabel}`, tone: "neutral" }
      : { direction: "flat", percent: 0, text: `Same as ${previousLabel}`, tone: "neutral" };
  }
  if (prev === 0) return { direction: "new", percent: null, text: `A fresh start — ${previousLabel} had none`, tone: "positive" };
  const pct = Math.abs(percentChange(cur, prev) ?? 0);
  // A change that rounds to 0% is "about the same", not a gain or a loss.
  if (pct === 0) return { direction: "flat", percent: 0, text: `About the same as ${previousLabel}`, tone: "neutral" };
  return cur > prev
    ? { direction: "up", percent: pct, text: `↑ ${pct}% vs ${previousLabel}`, tone: "positive" }
    : { direction: "down", percent: pct, text: `↓ ${pct}% vs ${previousLabel}`, tone: "soft" };
}

// ── greeting & cheerful wording ────────────────────────────────────────
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Hour of day (0–23) in Manila for an epoch-ms instant, independent of the machine's timezone. */
export function manilaHour(nowMs: number): number {
  return new Date(nowMs + MANILA_OFFSET_MS).getUTCHours();
}

export function greetingWord(nowMs: number): "Good morning" | "Good afternoon" | "Good evening" {
  const h = manilaHour(nowMs);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** "Dr. Maria Santos" whether or not the stored name already starts with "Dr". */
export function doctorDisplayName(name: string | null | undefined): string {
  const clean = (name ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "Doctor";
  return /^dr\.?\s/i.test(clean) ? clean.replace(/^dr\.?\s+/i, "Dr. ") : `Dr. ${clean}`;
}

export function greeting(nowMs: number, name: string | null | undefined): string {
  return `${greetingWord(nowMs)}, ${doctorDisplayName(name)}`;
}

function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One warm sentence under the greeting. Always upbeat, never a scolding. */
export function headline(period: PerformancePeriodName, s: PerformanceStats, previous: PerformanceStats): string {
  const seen = s.patients_seen;
  const phrase = PERIOD_PHRASE[period];
  if (seen === 0) {
    return period === "today"
      ? "A calm start — your first patient of the day will be along soon."
      : period === "week"
        ? "A fresh week — your numbers will fill in as you see patients."
        : "A fresh month — your numbers will fill in as you see patients.";
  }
  const money = s.collected > 0 ? ` and collected ${pesoLabel(s.collected)}` : "";
  const base = `You've seen ${plural(seen, "patient")} ${phrase}${money}`;
  if (seen > previous.patients_seen && previous.patients_seen > 0) return `${base} — busier than ${PREVIOUS_LABEL[period]}. Lovely work!`;
  if (s.collected > previous.collected && previous.collected > 0) return `${base} — up on ${PREVIOUS_LABEL[period]}. Lovely work!`;
  return `${base}. Thank you for caring for them.`;
}

/** Friendly empty-state copy per period. */
export function emptyMessage(period: PerformancePeriodName): string {
  return period === "today"
    ? "No completed visits yet today. Your numbers will appear here as you finish consultations."
    : `No completed visits ${PERIOD_PHRASE[period]} yet. They'll show up here as you finish consultations.`;
}

/** True when the period has nothing to celebrate or chart yet. */
export function isEmptyPeriod(s: PerformanceStats): boolean {
  return s.patients_seen === 0 && s.collected === 0 && s.billed === 0;
}

/** Average consult length, or null when there are too few samples to be honest about. */
export function avgConsultLabel(s: PerformanceStats, minSamples = 5): string | null {
  if (s.avg_consult_minutes == null || s.avg_consult_samples < minSamples) return null;
  return `${Math.round(s.avg_consult_minutes)} min`;
}

// ── "Also" strip ───────────────────────────────────────────────────────
export interface AlsoItem {
  key: string;
  icon: string;
  value: string;
  label: string;
}

/** The secondary counts under the cards. Zero-valued items stay (a clear 0 is information), except consult time. */
export function alsoItems(s: PerformanceStats): AlsoItem[] {
  const items: AlsoItem[] = [
    { key: "rx", icon: "medication", value: String(s.rx_groups), label: s.rx_groups === 1 ? "prescription written" : "prescriptions written" },
    { key: "cert", icon: "assignment_turned_in", value: String(s.med_certs), label: s.med_certs === 1 ? "medical certificate" : "medical certificates" },
    { key: "lab", icon: "biotech", value: String(s.lab_orders), label: s.lab_orders === 1 ? "lab order" : "lab orders" },
    { key: "followups", icon: "event_repeat", value: String(s.follow_up_visits), label: s.follow_up_visits === 1 ? "follow-up visit" : "follow-up visits" },
    { key: "first", icon: "waving_hand", value: String(s.first_time_patients), label: s.first_time_patients === 1 ? "first-time patient" : "first-time patients" },
  ];
  const avg = avgConsultLabel(s);
  if (avg) items.push({ key: "avg", icon: "timer", value: avg, label: "average consult" });
  return items;
}

// ── 14-day chart geometry (hand-drawn SVG) ─────────────────────────────
export type ChartMetric = "collected" | "patients_seen";

export interface ChartBar {
  date: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** "Mon 18" style label for the x axis. */
  label: string;
  isToday: boolean;
}

export interface ChartModel {
  width: number;
  height: number;
  bars: ChartBar[];
  /** y of the baseline. */
  baseline: number;
  /** The rounded-up top of the scale. */
  max: number;
  ticks: { value: number; y: number }[];
  total: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Wed 19" from a YYYY-MM-DD clinic date — pure calendar arithmetic, no timezone involved. */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}

/** Rounds a max up to a "nice" axis top (1, 2, 5 × 10ⁿ) so ticks read cleanly. */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}

export function buildChart(
  series: PerformanceDay[],
  metric: ChartMetric,
  today: string,
  size: { width: number; height: number; padLeft?: number; padRight?: number; padTop?: number; padBottom?: number } = { width: 640, height: 240 },
): ChartModel {
  const { width, height } = size;
  const padLeft = size.padLeft ?? 48;
  const padRight = size.padRight ?? 8;
  const padTop = size.padTop ?? 12;
  const padBottom = size.padBottom ?? 30;
  const innerW = Math.max(1, width - padLeft - padRight);
  const innerH = Math.max(1, height - padTop - padBottom);
  const values = series.map((d) => {
    const v = metric === "collected" ? d.collected : d.patients_seen;
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  });
  const max = niceMax(Math.max(0, ...values));
  const slot = series.length > 0 ? innerW / series.length : innerW;
  const barW = Math.max(2, Math.min(36, slot * 0.62));
  const baseline = padTop + innerH;
  const bars: ChartBar[] = series.map((d, i) => {
    const value = values[i];
    const h = value > 0 ? Math.max(3, (value / max) * innerH) : 0; // a visible stub for any non-zero day
    return {
      date: d.date,
      value,
      x: round(padLeft + i * slot + (slot - barW) / 2),
      y: round(baseline - h),
      width: round(barW),
      height: round(h),
      label: dayLabel(d.date),
      isToday: d.date === today,
    };
  });
  const ticks = [0, 0.5, 1].map((f) => ({ value: round(max * f), y: round(baseline - f * innerH) }));
  return { width, height, bars, baseline: round(baseline), max, ticks, total: values.reduce((a, b) => a + b, 0) };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A screen-reader summary of the chart, e.g. "Collected over the last 14 days: ₱12,400 in total; best day Tue 11 (₱3,000)." */
export function chartSummary(series: PerformanceDay[], metric: ChartMetric): string {
  const fmt = (n: number) => (metric === "collected" ? pesoLabel(n) : plural(n, "patient"));
  const total = series.reduce((a, d) => a + (metric === "collected" ? d.collected : d.patients_seen), 0);
  const best = series.reduce<PerformanceDay | null>((b, d) => {
    const v = metric === "collected" ? d.collected : d.patients_seen;
    const bv = b ? (metric === "collected" ? b.collected : b.patients_seen) : 0;
    return v > bv ? d : b;
  }, null);
  const what = metric === "collected" ? "Collected" : "Patients seen";
  if (!best) return `${what} over the last ${series.length} days: nothing yet.`;
  const bestV = metric === "collected" ? best.collected : best.patients_seen;
  return `${what} over the last ${series.length} days: ${fmt(total)} in total; best day ${dayLabel(best.date)} (${fmt(bestV)}).`;
}

/** Share (0–100) of each diagnosis relative to the busiest one — for the little bars. */
export function diagnosisBars(top: DoctorPerformance["top_diagnoses"]): { label: string; code: string | null; count: number; pct: number }[] {
  const max = Math.max(1, ...top.map((t) => t.count));
  return top.map((t) => ({ label: t.label, code: t.icd10_code, count: t.count, pct: Math.max(6, Math.round((t.count / max) * 100)) }));
}
//JJQR - END
