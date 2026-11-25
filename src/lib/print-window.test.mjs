//JJQR - AI (2026-11-25) - iPad Safari: the print window opens in the tap, before the data loads
import test from "node:test";
import assert from "node:assert/strict";
import { printAfterLoading, takeReservedPrintWindow, POPUP_BLOCKED_MESSAGE } from "./print-window.ts";

function fakeOpener({ blocked = false } = {}) {
  const log = [];
  const win = { closed: false, html: "", document: { write: (h) => { win.html += h; log.push("write"); }, close: () => {} }, close: () => { win.closed = true; log.push("close"); } };
  return { log, win, alerts: [], open() { log.push("open"); return blocked ? null : win; }, alert(m) { this.alerts.push(m); } };
}

test("the window opens before the data loads, and the print uses that same window", async () => {
  const o = fakeOpener();
  const r = await printAfterLoading(async () => {
    o.log.push("load");
    await new Promise((res) => setTimeout(res, 5));
    assert.equal(takeReservedPrintWindow(), o.win);
    assert.equal(takeReservedPrintWindow(), null, "only once");
    return true;
  }, o);
  assert.equal(r, true);
  assert.deepEqual(o.log.slice(0, 3), ["open", "write", "load"]);
  assert.match(o.win.html, /Preparing/);
  assert.equal(o.win.closed, false, "the print window stays open");
});

test("nothing to print: the window closes and the caller gets false (to show its own message)", async () => {
  const o = fakeOpener();
  assert.equal(await printAfterLoading(async () => false, o), false);
  assert.equal(o.win.closed, true);
  assert.equal(takeReservedPrintWindow(), null);
});

test("an error closes the window and is passed on", async () => {
  const o = fakeOpener();
  await assert.rejects(printAfterLoading(async () => { throw new Error("server down"); }, o), /server down/);
  assert.equal(o.win.closed, true);
});

test("blocked: says to allow pop-ups, does not load, reports handled", async () => {
  const o = fakeOpener({ blocked: true });
  let ran = false;
  assert.equal(await printAfterLoading(async () => { ran = true; return true; }, o), true);
  assert.equal(ran, false);
  assert.deepEqual(o.alerts, [POPUP_BLOCKED_MESSAGE]);
  assert.match(POPUP_BLOCKED_MESSAGE, /Allow pop-ups/);
});

test("no window outside a print", () => {
  assert.equal(takeReservedPrintWindow(), null);
});
//JJQR - END
