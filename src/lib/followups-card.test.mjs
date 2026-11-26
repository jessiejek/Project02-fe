//JJQR - AI (2026-11-27) - why: owner (t146u) follow-ups are reminders only: own card below the queue, never in "Needs attention · Today" or the queue
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/doctor/dashboard/page.tsx", import.meta.url), "utf8");

test("dashboard: follow-ups due today are split out of today's Needs attention", () => {
  assert.match(src, /todayFollowUps = \(todayAttentionAll\?\.items \?\? \[\]\)\.filter\(\(it\) => it\.kind === "followup"\)/);
  assert.match(src, /items: todayAttentionAll\.items\.filter\(\(it\) => it\.kind !== "followup"\)/);
});

test("dashboard: 'Follow-ups due today' card sits right after the queue card and hides when empty", () => {
  const queueEnd = src.indexOf("</Card>", src.indexOf("Your patient queue"));
  const card = src.indexOf(">Follow-ups due today<");
  const earlier = src.indexOf("<LeftoverQueue role=\"doctor\"");
  assert.ok(queueEnd > 0 && card > queueEnd && card < earlier);
  assert.match(src, /\{todayFollowUps\.length > 0 && \(/);
});
//JJQR - END
