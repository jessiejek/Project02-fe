//JJQR - AI (2026-11-25) - why: GAV-4 "Not finished on an earlier day" grouping rules
import test from "node:test";
import assert from "node:assert/strict";
import { groupLeftovers, isLeftoverOpen, leftoverStatus, leftoverDay, leftoverTotal, leftoverErrorText, LEFTOVER_OLD_SERVER } from "./leftover-queue.ts";

const TODAY = "2026-11-25";
const e = (id, date, status = "CheckedIn", extra = {}) => ({ booking_id: id, appointment_date: date, queue_number: "R-001", patient_id: "p", patient_name: id, patient_code: "", doctor_id: "d", status, visit_type: "New", amount_due: 450, checked_in_at: "2026-11-24T08:58:00Z", updated_at: "2026-11-24T08:52:00Z", is_walk_in: true, ...extra });

test("one group per earlier date, newest first, with day headers and counts", () => {
  const g = groupLeftovers([e("a", "2026-11-23"), e("b", "2026-11-24"), e("c", "2026-11-24", "InProgress")], TODAY);
  assert.deepEqual(g.map((x) => [x.header, x.countLabel, x.chip]), [["Tue, Nov 24", "2 patients", "Nov 24"], ["Mon, Nov 23", "1 patient", "Nov 23"]]);
  assert.equal(leftoverTotal(g), 3);
});

test("today, future, too old, finished and duplicates are dropped", () => {
  const g = groupLeftovers([e("t", TODAY), e("f", "2026-11-26"), e("old", "2026-10-25"), e("edge", "2026-10-26"), e("done", "2026-11-24", "Completed"), e("ns", "2026-11-24", "NoShow"), e("d", "2026-11-24"), e("d", "2026-11-24")], TODAY);
  assert.deepEqual(g.map((x) => [x.date, x.items.map((i) => i.booking_id)]), [["2026-11-24", ["d"]], ["2026-10-26", ["edge"]]]);
});

test("priority lane first inside a date", () => {
  const g = groupLeftovers([e("r", "2026-11-24"), e("s", "2026-11-24", "CheckedIn", { is_priority: true })], TODAY);
  assert.deepEqual(g[0].items.map((i) => i.booking_id), ["s", "r"]);
});

test("most recent date open, older closed, a toggle wins", () => {
  const g = groupLeftovers([e("a", "2026-11-23"), e("b", "2026-11-24")], TODAY);
  assert.equal(isLeftoverOpen(g, "2026-11-24", {}), true);
  assert.equal(isLeftoverOpen(g, "2026-11-23", {}), false);
  assert.equal(isLeftoverOpen(g, "2026-11-24", { "2026-11-24": false }), false);
  assert.equal(isLeftoverOpen(g, "2026-11-23", { "2026-11-23": true }), true);
});

test("status text: waiting since the date, in progress since date and Manila time", () => {
  assert.deepEqual(leftoverStatus(e("a", "2026-11-24"), TODAY), { pill: "Waiting", since: "since Nov 24" });
  assert.deepEqual(leftoverStatus(e("a", "2026-11-24", "InProgress"), TODAY), { pill: "In progress", since: "since Nov 24 4:52 PM" });
  assert.deepEqual(leftoverStatus(e("a", "2026-11-24", "OnHold"), TODAY), { pill: "On hold", since: "since Nov 24" });
  assert.equal(leftoverDay("2025-12-31", TODAY), "Wed, Dec 31, 2025");
});

test("errors in plain words", () => {
  assert.equal(leftoverErrorText(409, { message: "This patient is already on today's queue." }), "This patient is already on today's queue.");
  assert.equal(leftoverErrorText(404, undefined), LEFTOVER_OLD_SERVER);
  assert.equal(leftoverErrorText(405, ""), LEFTOVER_OLD_SERVER);
});
//JJQR - END

//JJQR - AI (2026-11-26) - why: earlier days are their own groups (Queue + Needs attention per date), never mixed into today
test("earlier days merge leftovers and Needs attention by date; today and future are never included", async () => {
  const { earlierDays, isEarlierDayOpen, dayCountLabel } = await import("./leftover-queue.ts");
  const g = groupLeftovers([e("a", "2026-11-24"), e("b", "2026-11-24"), e("c", "2026-11-22")], TODAY);
  const days = earlierDays(g, [{ date: "2026-11-24", count: 1 }, { date: "2026-11-23", count: 2 }, { date: TODAY, count: 5 }, { date: "2026-11-26", count: 1 }], TODAY);
  assert.deepEqual(days.map((d) => [d.header, d.countLabel, d.queue.length, d.attentionCount]), [
    ["Tue, Nov 24", "2 in queue · 1 needs attention", 2, 1],
    ["Mon, Nov 23", "2 need attention", 0, 2],
    ["Sun, Nov 22", "1 in queue", 1, 0],
  ]);
  assert.equal(isEarlierDayOpen(days, "2026-11-24", {}), true);
  assert.equal(isEarlierDayOpen(days, "2026-11-23", {}), false);
  assert.equal(isEarlierDayOpen(days, "2026-11-24", { "2026-11-24": false }), false);
  assert.equal(dayCountLabel(0, 0), "");
  assert.deepEqual(earlierDays([], [], TODAY), []);
});
//JJQR - END
