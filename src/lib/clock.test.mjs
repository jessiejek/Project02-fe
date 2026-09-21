// Unit tests for the clinic clock (P0.4). Run: `npm run test:unit`
// (Node's built-in runner + type stripping; no extra dependencies.)
import test from "node:test";
import assert from "node:assert/strict";
import {
  todayManila,
  toManilaDate,
  currentMonthManila,
  addDaysToDate,
  daysFromTodayManila,
  previousMonth,
  manilaTodayAsLocalDate,
} from "./clock.ts";

const utc = (iso) => Date.parse(iso);

test("todayManila: the whole 00:00–08:00 PHT window is the NEW Manila day, not yesterday", () => {
  // 16:00Z–23:59:59Z on the 21st is 00:00–07:59:59 PHT on the 22nd.
  for (const iso of ["2026-09-21T16:00:00Z", "2026-09-21T20:30:00Z", "2026-09-21T23:59:59Z"]) {
    assert.equal(todayManila(utc(iso)), "2026-09-22", iso);
    // …and the naive UTC date — what the old code used — is exactly one day behind.
    assert.equal(new Date(utc(iso)).toISOString().slice(0, 10), "2026-09-21");
  }
});

test("todayManila: flips exactly at Manila midnight", () => {
  assert.equal(todayManila(utc("2026-09-21T15:59:59Z")), "2026-09-21"); // 23:59:59 PHT
  assert.equal(todayManila(utc("2026-09-21T16:00:00Z")), "2026-09-22"); // 00:00:00 PHT
});

test("todayManila: agrees with UTC for the rest of the day (08:00–16:00Z)", () => {
  assert.equal(todayManila(utc("2026-09-21T00:00:00Z")), "2026-09-21");
  assert.equal(todayManila(utc("2026-09-21T12:00:00Z")), "2026-09-21");
});

test("todayManila: month, year and leap-day rollovers", () => {
  assert.equal(todayManila(utc("2026-09-30T16:00:00Z")), "2026-10-01");
  assert.equal(todayManila(utc("2026-12-31T16:00:00Z")), "2027-01-01");
  assert.equal(todayManila(utc("2028-02-28T16:00:00Z")), "2028-02-29");
  assert.equal(todayManila(utc("2027-02-28T16:00:00Z")), "2027-03-01");
});

test("todayManila: independent of the machine's timezone (the browser can be anywhere)", () => {
  // The implementation must not read local time. Same instant → same answer regardless of TZ.
  const instant = utc("2026-09-21T20:30:00Z");
  const before = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Manila", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      assert.equal(todayManila(instant), "2026-09-22", tz);
      assert.equal(toManilaDate(new Date(instant)), "2026-09-22", tz);
    }
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test("toManilaDate / currentMonthManila", () => {
  assert.equal(toManilaDate(new Date("2026-09-21T20:30:00Z")), "2026-09-22");
  assert.equal(currentMonthManila(utc("2026-09-30T20:00:00Z")), "2026-10"); // month flips in the bug window too
});

test("addDaysToDate is pure calendar arithmetic", () => {
  assert.equal(addDaysToDate("2026-09-22", 7), "2026-09-29");
  assert.equal(addDaysToDate("2026-09-22", -30), "2026-08-23");
  assert.equal(addDaysToDate("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysToDate("2028-02-28", 1), "2028-02-29");
  assert.equal(addDaysToDate("2026-03-31", 1), "2026-04-01");
  assert.equal(addDaysToDate("2026-09-22", 0), "2026-09-22");
});

test("daysFromTodayManila builds on the Manila date, not the UTC date", () => {
  const inBugWindow = utc("2026-09-21T20:30:00Z"); // 22nd in Manila
  assert.equal(daysFromTodayManila(7, inBugWindow), "2026-09-29"); // old code: 2026-09-28
  assert.equal(daysFromTodayManila(-30, inBugWindow), "2026-08-23");
});

test("previousMonth handles the January wrap", () => {
  assert.equal(previousMonth("2026-09"), "2026-08");
  assert.equal(previousMonth("2026-01"), "2025-12");
  assert.equal(previousMonth("2026-03"), "2026-02");
});

test("manilaTodayAsLocalDate is local midnight of the Manila calendar day", () => {
  const d = manilaTodayAsLocalDate(utc("2026-09-21T20:30:00Z"));
  assert.deepEqual([d.getFullYear(), d.getMonth() + 1, d.getDate()], [2026, 9, 22]);
  assert.deepEqual([d.getHours(), d.getMinutes()], [0, 0]);
});
