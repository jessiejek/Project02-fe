//JJQR - AI (Nov 25, 2026) - GAV-2: "Needs attention" grouped by date
import test from "node:test";
import assert from "node:assert/strict";
import { groupAttention, isGroupOpen, shortDate, itemsLabel, attentionFrom } from "./attention-groups.ts";

const e = (key, kind, date) => ({ key, kind, date, name: key, what: "", note: "", action: "", href: "" });
const TODAY = "2026-11-25";

test("today first, then older dates newest first; headers and counts", () => {
  const g = groupAttention([e("a", "chart", "2026-11-23"), e("b", "unpaid", TODAY), e("c", "unpaid", "2026-11-24"), e("d", "chart", "2026-11-24"), e("x", "followup", TODAY)], TODAY);
  assert.deepEqual(g.map((x) => x.header), ["Today · Nov 25", "Nov 24", "Nov 23"]);
  assert.deepEqual(g.map((x) => x.countLabel), ["2 items", "2 items", "1 item"]);
  assert.equal(g[0].isToday, true);
});

test("inside a date: unpaid, then charts, then follow-ups", () => {
  const g = groupAttention([e("f", "followup", TODAY), e("c", "chart", TODAY), e("u", "unpaid", TODAY)], TODAY);
  assert.deepEqual(g[0].items.map((i) => i.kind), ["unpaid", "chart", "followup"]);
});

test("not cleared on an earlier day stays under its own date; future, too old and duplicates are dropped", () => {
  assert.equal(attentionFrom(TODAY), "2026-10-26");
  const g = groupAttention([e("old", "unpaid", "2026-10-26"), e("tooold", "unpaid", "2026-10-25"), e("future", "unpaid", "2026-11-26"), e("dup", "chart", TODAY), e("dup", "chart", TODAY)], TODAY);
  assert.deepEqual(g.map((x) => [x.date, x.items.length]), [[TODAY, 1], ["2026-10-26", 1]]);
});

test("open/closed: today open, older closed, the doctor's toggle wins", () => {
  const today = { date: TODAY, isToday: true }, older = { date: "2026-11-24", isToday: false };
  assert.equal(isGroupOpen(today, {}), true);
  assert.equal(isGroupOpen(older, {}), false);
  assert.equal(isGroupOpen(older, { "2026-11-24": true }), true);
  assert.equal(isGroupOpen(today, { [TODAY]: false }), false);
});

test("dates: another year shows the year; item counts", () => {
  assert.equal(shortDate("2025-12-31", "2026-01-02"), "Dec 31, 2025");
  assert.equal(shortDate("2026-01-02", "2026-01-02"), "Jan 2");
  assert.equal(itemsLabel(1), "1 item");
  assert.equal(itemsLabel(3), "3 items");
});
//JJQR - END

//JJQR - AI (Nov 25, 2026) - doctor "Mark received"
import { markReceivedQuestion, pesoLabel } from "./attention-groups.ts";
test("Mark received question names the exact peso amount", () => {
  assert.equal(markReceivedQuestion(450), "Mark ₱450 received in cash?");
  assert.equal(pesoLabel(1500), "₱1,500");
  assert.equal(pesoLabel(450.5), "₱450.50");
});
//JJQR - END

//JJQR - AI (Nov 25, 2026) - code review: Mark received refusals in plain words
import { markReceivedErrorText, MARK_RECEIVED_OLD_SERVER, MARK_RECEIVED_NOT_YOURS, MARK_RECEIVED_GENERIC } from "./attention-groups.ts";

test("Mark received: server message wins; old server, 403 and no answer get plain words", () => {
  assert.equal(markReceivedErrorText(409, { error: "amount_changed", message: "The amount due is now ₱500, not ₱450. Check the visit and try again." }), "The amount due is now ₱500, not ₱450. Check the visit and try again.");
  assert.equal(markReceivedErrorText(404, { message: "This visit was not found." }), "This visit was not found.");
  assert.equal(markReceivedErrorText(404, ""), MARK_RECEIVED_OLD_SERVER);
  assert.equal(markReceivedErrorText(405, undefined), MARK_RECEIVED_OLD_SERVER);
  assert.equal(markReceivedErrorText(403, ""), MARK_RECEIVED_NOT_YOURS);
  assert.equal(markReceivedErrorText(500, "<html>"), MARK_RECEIVED_GENERIC);
  assert.equal(markReceivedErrorText(undefined, undefined), MARK_RECEIVED_GENERIC);
});
//JJQR - END
