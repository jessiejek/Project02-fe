//JJQR - AI (Nov 21, 2026) - medical certificate: highlight "Please come back on" when the examination dates change
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/doctor/consultation2/[bookingId]/page.tsx", import.meta.url), "utf8");

test("changing either examination date marks the come-back date for review", () => {
  assert.match(src, /const \[mcComeBackStale, setMcComeBackStale\] = useState\(false\);/);
  assert.match(src, /onChange=\{\(e\) => \{ setMcExamFrom\(e\.target\.value\); setMcComeBackStale\(true\); \}\}/);
  assert.match(src, /onChange=\{\(e\) => \{ setMcExamTo\(e\.target\.value\); setMcComeBackStale\(true\); \}\}/);
});

test("editing the come-back date, or choosing 'Keep', clears the highlight", () => {
  assert.match(src, /setMcComeBackOn\(e\.target\.value\); setMcComeBackStale\(false\);/);
  assert.match(src, /onClick=\{\(\) => setMcComeBackStale\(false\)\} className="underline"/);
});

test("a come-back date before the last examination day is flagged even without a date change", () => {
  assert.match(src, /const mcComeBackBeforeUntil = mcComeBackOn !== "" && mcExamTo !== "" && mcComeBackOn < mcExamTo;/);
  assert.match(src, /const mcComeBackNeedsReview = mcComeBackStale \|\| mcComeBackBeforeUntil;/);
  assert.match(src, /This date is before the last examination day — please check it\./);
});

test("the highlight is visible and announced (warning colours, aria-invalid, status hint)", () => {
  assert.match(src, /border-status-warning-border bg-status-warning-surface ring-2 ring-status-warning\/40/);
  assert.match(src, /aria-invalid=\{mcComeBackNeedsReview \|\| undefined\}/);
  assert.match(src, /id="mc-comeback-hint" role="status"/);
  assert.match(src, /You changed the examination dates — please check or update this date\./);
  assert.match(src, /You changed the examination dates — please choose when the patient should come back\./);
});

test("loading a saved certificate does not trigger the highlight (only the user's own date edits do)", () => {
  // the flag is only ever set inside the two onChange handlers
  assert.equal((src.match(/setMcComeBackStale\(true\)/g) ?? []).length, 2);
});
//JJQR - END
