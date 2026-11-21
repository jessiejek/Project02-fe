//JJQR - AI (Nov 21, 2026) - staff SEE a doctor-waived visit on "Collect payments" (₱0 due) and confirm it
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/staff/payments/page.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("./data/payments.ts", import.meta.url), "utf8");

test("the API layer can list waived visits and confirm a waiver", () => {
  assert.match(api, /api\.get<WaivedVisit\[\]>\("\/api\/payments\/waived-awaiting-confirmation"\)/);
  assert.match(api, /api\.post\(`\/api\/payments\/\$\{paymentId\}\/confirm-waiver`, \{\}\)/);
});

test("waived visits are merged into the same list with ₱0 due and the reason", () => {
  assert.match(page, /queryWaivedAwaitingConfirmation\(\)/);
  assert.match(page, /amountDue: 0,\s*waivedReason: w\.waived_reason \?\? ""/);
  assert.match(page, /setQueue\(\[\.\.\.today, \.\.\.older, \.\.\.waived\]\)/);
  // a failure to load the waived list never hides the money still owed
  assert.match(page, /waived = \[\]; \/\/ the money list above is still right without it/);
});

test("a waived row says 'Waived by doctor', shows the reason and offers Confirm waiver (not Record payment)", () => {
  assert.match(page, /<StatusPill status="Waived" \/><span[^>]*>by doctor<\/span>/);
  assert.match(page, /\{r\.waivedReason && <span/);
  assert.match(page, /Confirm waiver<\/Button>/);
  assert.match(page, /r\.waivedReason === undefined\s*\?\s*<Button variant="secondary" onClick=\{\(\) => openPayment\(r\)\}>Record payment<\/Button>/);
  assert.match(page, /data-testid="waived-row"/);
});

test("'Waiting to pay' counts only visits that still owe, and waived ones have their own count", () => {
  assert.match(page, /const waitingToPay = queue\.filter\(\(b\) => b\.waivedReason === undefined\)\.length;/);
  assert.match(page, /const waivedToConfirm = queue\.length - waitingToPay;/);
  assert.match(page, /Waived — to confirm/);
  assert.match(page, /\{waitingToPay\}/);
});

test("confirming removes the row and says ₱0 was collected; a failure shows an error and keeps the row", () => {
  assert.match(page, /await confirmWaiver\(r\.paymentId\);\s*setQueue\(\(prev\) => prev\.filter\(\(x\) => x\.id !== r\.id\)\);/);
  assert.match(page, /waiver confirmed — ₱0 collected\./);
  assert.match(page, /Could not confirm the waiver\. Please try again\./);
});
//JJQR - END

//JJQR - AI (Nov 21, 2026) - the Record payment dialog never shows for a visit that has turned into a waived row
test("the dialog is tied to a row that still owes, so it closes by itself when the visit becomes waived", () => {
  assert.match(page, /return row && row\.waivedReason === undefined \? row : null;/);
  assert.match(page, /isOpen=\{activeBooking !== null\}/);
});
//JJQR - END
