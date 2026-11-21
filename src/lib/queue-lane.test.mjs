//JJQR - AI (Nov 21, 2026) - tests for the senior/PWD priority lane and the SignalR catch-up
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPriorityQueueNumber, compareQueueNumbers, queueLaneLabel } from "./queue-lane.ts";
import { orderedAppointments } from "../components/doctor/appointments/model.ts";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// ── the lane helpers ────────────────────────────────────────────────────────

test("only S- numbers are priority; R-, legacy Q- and blanks are regular", () => {
  assert.equal(isPriorityQueueNumber("S-003"), true);
  assert.equal(isPriorityQueueNumber("R-014"), false);
  assert.equal(isPriorityQueueNumber("Q-052"), false);
  assert.equal(isPriorityQueueNumber(null), false);
  assert.equal(isPriorityQueueNumber(undefined), false);
  assert.equal(queueLaneLabel("S-001"), "Priority · Senior/PWD");
  assert.equal(queueLaneLabel("R-001"), null);
});

test("every S- sorts ahead of every R-, even a lower-numbered one", () => {
  const sorted = ["R-001", "R-002", "S-005", "R-003", "S-004"].sort(compareQueueNumbers);
  assert.deepEqual(sorted, ["S-004", "S-005", "R-001", "R-002", "R-003"]);
});

test("inside a lane numbers sort naturally (R-2 before R-10, not alphabetically)", () => {
  assert.deepEqual(["R-10", "R-2", "R-1"].sort(compareQueueNumbers), ["R-1", "R-2", "R-10"]);
  assert.deepEqual(["S-10", "S-9"].sort(compareQueueNumbers), ["S-9", "S-10"]);
});

test("a leftover pre-lane Q- number still sorts before the first R- of the same day", () => {
  assert.deepEqual(["R-053", "Q-052", "S-001"].sort(compareQueueNumbers), ["S-001", "Q-052", "R-053"]);
});

// ── the doctor's appointment list uses it ───────────────────────────────────

const row = (id, q, name = id) => ({ id, patientName: name, patientCode: null, appointmentDate: "2026-11-21", queueNumber: q, status: "CheckedIn", paymentStatus: null, visitType: "Consultation" });

test("doctor appointments list: a senior who arrived last is listed first", () => {
  const ids = orderedAppointments([row("a", "R-001"), row("b", "R-002"), row("c", "S-001")], "today").map((r) => r.id);
  assert.deepEqual(ids, ["c", "a", "b"]);
});

// ── wiring (source assertions, like the other UI tests) ─────────────────────

test("doctor dashboard 'up next': in-progress stays on top, then priority lane, and the row says Priority", () => {
  const src = read("../app/doctor/dashboard/page.tsx");
  assert.match(src, /Number\(b\.status === "InProgress"\) - Number\(a\.status === "InProgress"\) \|\| compareQueueNumbers\(a\.queue_number, b\.queue_number\)/);
  assert.match(src, /Priority \(Senior\/PWD\)/);
  assert.equal(src.includes('.localeCompare(String(b.queue_number ?? "")'), false); // the old alphabetical sort is gone
});

test("staff queue shows a Priority chip on both the phone list and the desktop table", () => {
  const src = read("../app/staff/queue/page.tsx");
  assert.equal((src.match(/isPriorityQueueNumber\(e\.queue_number\) &&/g) ?? []).length, 2);
});

test("walk-in ticket and printed slip say Priority lane; the discount box explains the S- number", () => {
  const src = read("../components/walkin/WalkInWizard.tsx");
  assert.match(src, /ticket\.is_priority && /);
  assert.match(src, /PRIORITY LANE · Senior \/ PWD/);
  assert.match(src, /priority \(S-\) queue number/);
});

test("queue API types carry the lane", () => {
  const src = read("./data/queue.ts");
  assert.match(src, /lane\?: "R" \| "S";/);
  assert.equal((src.match(/is_priority\?: boolean;/g) ?? []).length, 2);
});

// ── SignalR: catch up after the connection was gone ─────────────────────────

test("clinicHub: every way the connection comes back triggers a resync", () => {
  const src = read("./realtime/clinicHub.ts");
  assert.match(src, /connection\.onreconnected\(\(\) => resyncAll\(\)\)/);                 // automatic reconnect worked
  assert.match(src, /if \(everConnected \|\| retryAttempt > 0\) resyncAll\(\)/);            // manual retry loop worked
  assert.match(src, /window\.addEventListener\("online", wake\)/);                          // wifi came back
  assert.match(src, /document\.addEventListener\("visibilitychange", wake\)/);              // laptop woke / tab visible again
});

test("clinicHub: resync runs once per screen (QueueUpdated listener only) and is cleaned up", () => {
  const src = read("./realtime/clinicHub.ts");
  assert.match(src, /if \(event === "QueueUpdated"\) resyncHandlers\.add\(resync\)/);
  assert.match(src, /resyncHandlers\.delete\(resync\)/);
});

test("clinicHub: the first connect on a fresh page does not trigger a pointless resync", () => {
  const src = read("./realtime/clinicHub.ts");
  assert.match(src, /let everConnected = false/);
  assert.match(src, /everConnected = true/);
});
//JJQR - END
