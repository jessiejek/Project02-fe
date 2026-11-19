// JJQR - AI (Nov 19, 2026) - unit tests for the doctor Performance helpers. Run: `npm run test:unit`
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  percentChange, describeChange, greetingWord, greeting, doctorDisplayName, headline, emptyMessage, isEmptyPeriod,
  pesoLabel, pesoCompact, avgConsultLabel, alsoItems, dayLabel, niceMax, buildChart, chartSummary, diagnosisBars, isPeriod, manilaHour,
  PERIOD_OPTIONS, PREVIOUS_LABEL,
} from "./doctor/performance.ts";

const stats = (o = {}) => ({
  patients_seen: 0, unique_patients: 0, new_visits: 0, follow_up_visits: 0, first_time_patients: 0,
  collected: 0, billed: 0, waived: 0, refunded: 0, unpaid_total: 0, rx_groups: 0, med_certs: 0, lab_orders: 0,
  no_shows: 0, cancellations: 0, avg_consult_minutes: null, avg_consult_samples: 0, ...o,
});
const utc = (iso) => Date.parse(iso);

test("percentChange: rounds, handles drops, and refuses a zero baseline", () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(50, 100), -50);
  assert.equal(percentChange(101, 300), -66);
  assert.equal(percentChange(5, 0), null);
  assert.equal(percentChange(0, 0), null);
  assert.equal(percentChange(Number.NaN, 4), null);
});

test("describeChange: up is green, a dip is soft grey — NEVER red / alarming", () => {
  const up = describeChange(120, 100, "yesterday");
  assert.deepEqual([up.direction, up.percent, up.tone, up.text], ["up", 20, "positive", "↑ 20% vs yesterday"]);
  const down = describeChange(80, 100, "last week");
  assert.deepEqual([down.direction, down.percent, down.tone], ["down", 20, "soft"]);
  assert.equal(down.text, "↓ 20% vs last week");
  for (const c of [up, down, describeChange(0, 0, "x"), describeChange(3, 0, "x"), describeChange(5, 5, "x")]) {
    assert.notEqual(c.tone, "danger");
    assert.ok(["positive", "soft", "neutral"].includes(c.tone));
    assert.doesNotMatch(c.text, /worse|bad|drop|lost|fell|down by/i);
  }
});

test("describeChange: no baseline, flat, and rounds-to-zero cases are gentle and never NaN/Infinity", () => {
  assert.equal(describeChange(4, 0, "yesterday").direction, "new");
  assert.equal(describeChange(0, 0, "yesterday").direction, "flat");
  assert.equal(describeChange(7, 7, "yesterday").text, "Same as yesterday");
  const tiny = describeChange(1001, 1000, "yesterday"); // 0.1% → "about the same"
  assert.equal(tiny.direction, "flat");
  for (const c of [describeChange(Number.NaN, 3, "x"), describeChange(3, Number.NaN, "x")]) assert.doesNotMatch(c.text, /NaN|Infinity/);
});

test("greetingWord: Manila hour, independent of the machine timezone", () => {
  assert.equal(greetingWord(utc("2026-11-19T00:00:00Z")), "Good morning"); // 08:00 PHT
  assert.equal(greetingWord(utc("2026-11-19T03:59:59Z")), "Good morning"); // 11:59 PHT
  assert.equal(greetingWord(utc("2026-11-19T04:00:00Z")), "Good afternoon"); // 12:00 PHT
  assert.equal(greetingWord(utc("2026-11-19T09:59:59Z")), "Good afternoon"); // 17:59 PHT
  assert.equal(greetingWord(utc("2026-11-19T10:00:00Z")), "Good evening"); // 18:00 PHT
  assert.equal(greetingWord(utc("2026-11-19T16:00:00Z")), "Good morning"); // 00:00 PHT (next day)
  const before = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Manila"]) {
      process.env.TZ = tz;
      assert.equal(manilaHour(utc("2026-11-19T04:00:00Z")), 12, tz);
    }
  } finally {
    if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  }
});

test("doctorDisplayName / greeting: adds Dr. once, copes with blanks", () => {
  assert.equal(doctorDisplayName("Maria Santos"), "Dr. Maria Santos");
  assert.equal(doctorDisplayName("Dr. Maria Santos"), "Dr. Maria Santos");
  assert.equal(doctorDisplayName("dr maria  santos"), "Dr. maria santos");
  assert.equal(doctorDisplayName("  "), "Doctor");
  assert.equal(doctorDisplayName(undefined), "Doctor");
  assert.equal(greeting(utc("2026-11-19T00:00:00Z"), "Maria Santos"), "Good morning, Dr. Maria Santos");
});

test("peso formatting: whole pesos, centavos only when present, safe on bad input", () => {
  assert.equal(pesoLabel(1250), "₱1,250");
  assert.equal(pesoLabel(1250.5), "₱1,250.5");
  assert.equal(pesoLabel(0), "₱0");
  assert.equal(pesoLabel(null), "₱0");
  assert.equal(pesoLabel(Number.NaN), "₱0");
  assert.equal(pesoCompact(950), "₱950");
  assert.equal(pesoCompact(1200), "₱1.2k");
  assert.equal(pesoCompact(12400), "₱12k");
  assert.equal(pesoCompact(1_500_000), "₱1.5M");
  assert.equal(pesoCompact(-5), "₱0");
});

test("headline: warm and specific, never negative — even for an empty day", () => {
  assert.match(headline("today", stats(), stats()), /calm start/);
  assert.match(headline("week", stats(), stats()), /fresh week/);
  assert.match(headline("month", stats(), stats()), /fresh month/);
  const busy = headline("today", stats({ patients_seen: 6, collected: 4500 }), stats({ patients_seen: 3, collected: 2000 }));
  assert.match(busy, /seen 6 patients today and collected ₱4,500/);
  assert.match(busy, /busier than yesterday/);
  assert.match(headline("today", stats({ patients_seen: 1 }), stats({ patients_seen: 5 })), /seen 1 patient today\./);
  for (const h of [busy, headline("week", stats({ patients_seen: 2 }), stats({ patients_seen: 9, collected: 9000 }))]) {
    assert.doesNotMatch(h, /only|less|fewer|slow|worse|bad|NaN/i);
  }
});

test("emptyMessage / isEmptyPeriod", () => {
  assert.match(emptyMessage("today"), /No completed visits yet today/);
  assert.match(emptyMessage("week"), /this week/);
  assert.equal(isEmptyPeriod(stats()), true);
  assert.equal(isEmptyPeriod(stats({ patients_seen: 1 })), false);
  assert.equal(isEmptyPeriod(stats({ billed: 1 })), false);
});

test("avgConsultLabel: hidden until enough samples", () => {
  assert.equal(avgConsultLabel(stats({ avg_consult_minutes: 12.4, avg_consult_samples: 4 })), null);
  assert.equal(avgConsultLabel(stats({ avg_consult_minutes: 12.4, avg_consult_samples: 5 })), "12 min");
  assert.equal(avgConsultLabel(stats()), null);
});

test("alsoItems: singular/plural and the optional consult-time item", () => {
  const items = alsoItems(stats({ rx_groups: 1, med_certs: 2, lab_orders: 0, follow_up_visits: 1, first_time_patients: 3, avg_consult_minutes: 9, avg_consult_samples: 8 }));
  const by = Object.fromEntries(items.map((i) => [i.key, i]));
  assert.equal(by.rx.label, "prescription written");
  assert.equal(by.cert.label, "medical certificates");
  assert.equal(by.lab.value, "0");
  assert.equal(by.followups.label, "follow-up visit");
  assert.equal(by.first.label, "first-time patients");
  assert.equal(by.avg.value, "9 min");
  assert.equal(alsoItems(stats()).some((i) => i.key === "avg"), false);
});

test("dayLabel / niceMax", () => {
  assert.equal(dayLabel("2026-11-19"), "Thu 19");
  assert.equal(dayLabel("2026-11-16"), "Mon 16");
  assert.equal(dayLabel("bad"), "bad");
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(1200), 2000);
  assert.equal(niceMax(4500), 5000);
  assert.equal(niceMax(5001), 10000);
});

const series = (vals) => vals.map((v, i) => ({ date: `2026-11-${String(6 + i).padStart(2, "0")}`, patients_seen: v[0], collected: v[1], billed: v[1] }));

test("buildChart: 14 bars, scaled to a nice max, today highlighted, empty days have no height", () => {
  const s = series([[0, 0], [2, 1000], [1, 500], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [3, 2500], [4, 4000]]);
  const c = buildChart(s, "collected", "2026-11-19");
  assert.equal(c.bars.length, 14);
  assert.equal(c.max, 5000);
  assert.equal(c.total, 8000);
  assert.equal(c.bars[0].height, 0);
  assert.equal(c.bars[13].isToday, true);
  assert.equal(c.bars.filter((b) => b.isToday).length, 1);
  assert.ok(c.bars[13].height > c.bars[12].height && c.bars[12].height > c.bars[1].height);
  for (const b of c.bars) {
    assert.ok(b.x >= 0 && b.x + b.width <= c.width, "bar inside the viewBox");
    assert.ok(b.y >= 0 && b.y + b.height <= c.baseline + 0.01);
  }
  assert.deepEqual(c.ticks.map((t) => t.value), [0, 2500, 5000]);
});

test("buildChart: all zeros, a single tiny value, NaN and an empty series never throw or produce NaN", () => {
  for (const s of [series(Array.from({ length: 14 }, () => [0, 0])), series([[1, 1]]), [], series([[Number.NaN, Number.NaN]])]) {
    const c = buildChart(s, "patients_seen", "2026-11-19");
    for (const b of c.bars) for (const k of ["x", "y", "width", "height"]) assert.ok(Number.isFinite(b[k]), k);
    for (const t of c.ticks) assert.ok(Number.isFinite(t.y));
  }
  const tiny = buildChart(series([[0, 0], [1, 1]]), "collected", "x");
  assert.ok(tiny.bars[1].height >= 3, "a non-zero day is always visible");
});

test("chartSummary: spoken summary names the best day", () => {
  const s = series([[1, 500], [2, 3000], [0, 0]]);
  assert.equal(chartSummary(s, "collected"), "Collected over the last 3 days: ₱3,500 in total; best day Sat 7 (₱3,000).");
  assert.equal(chartSummary(s, "patients_seen"), "Patients seen over the last 3 days: 3 patients in total; best day Sat 7 (2 patients).");
  assert.match(chartSummary([], "collected"), /nothing yet/);
});

test("diagnosisBars: the busiest is 100%, every row stays visible", () => {
  const rows = diagnosisBars([
    { icd10_code: "J00", label: "Common cold", count: 10 },
    { icd10_code: null, label: "Other", count: 1 },
  ]);
  assert.equal(rows[0].pct, 100);
  assert.equal(rows[1].pct, 10);
  assert.deepEqual(diagnosisBars([]), []);
});

test("period constants", () => {
  assert.deepEqual(PERIOD_OPTIONS.map((p) => p.id), ["today", "week", "month"]);
  assert.deepEqual(PERIOD_OPTIONS.map((p) => p.label), ["Today", "This week", "This month"]);
  assert.equal(PREVIOUS_LABEL.week, "last week");
  assert.equal(isPeriod("week"), true);
  assert.equal(isPeriod("year"), false);
  assert.equal(isPeriod(null), false);
});

test("fetch wrapper: GETs /api/doctor/performance with only a period (never a doctor id)", () => {
  const src = readFileSync(new URL("./data/doctor-performance.ts", import.meta.url), "utf8");
  assert.match(src, /api\.get<DoctorPerformance>\("\/api\/doctor\/performance", \{ query: \{ period \}/);
  assert.doesNotMatch(src, /doctorId|doctor_id=/);
});
