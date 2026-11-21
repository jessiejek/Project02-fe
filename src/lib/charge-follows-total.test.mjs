//JJQR - AI (Nov 21, 2026) - the Charge amount follows the computed total until the doctor types a different one
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/doctor/consultation2/[bookingId]/page.tsx", import.meta.url), "utf8");

test("the amount shown is the live computed total unless the doctor typed one", () => {
  assert.match(page, /const \[pfAmountEdited, setPfAmountEdited\] = useState\(false\);/);
  assert.match(page, /pfDecision === "charge" && !pfAmountEdited && previewFee !== null\s*\?\s*String\(previewFee\)\s*:\s*pfAmount/);
});

test("typing in the amount box marks it as the doctor's own amount", () => {
  assert.match(page, /onChange=\{\(e\) => \{ setPfAmount\(e\.target\.value\); setPfAmountEdited\(true\); setPfOverrideBase\(previewFee\); \}\}/);
});

test("only a typed amount is sent; otherwise the server uses the computed fee (so a later certificate is charged)", () => {
  assert.match(page, /pf_amount: pfDecision === "charge" && pfAmountEdited && pfAmount\.trim\(\) !== "" \? Number\(pfAmount\) \|\| null : null/);
});

test("the auto-filled total is never baked into the editor on save, and the Charge tab no longer sets an amount", () => {
  assert.equal(page.includes("setPfAmount(pfAmountShown)"), false);
  assert.equal(/if \(!pfAmount\.trim\(\) && previewFee !== null\) setPfAmount\(String\(previewFee\)\)/.test(page), false);
});

test("a stored amount counts as the doctor's own; none stored means follow the total (load and cancel-amend)", () => {
  assert.equal((page.match(/setPfAmountEdited\(pfEditorAmountFromStored\((fd|source\?\.feeDecision)\) !== ""\)/g) ?? []).length, 2);
});

test("a different typed amount is called out, with a one-click way back to the computed total", () => {
  assert.match(page, /data-testid="pf-amount-differs"/);
  assert.match(page, /the computed total for this visit is \{formatPeso\(previewFee\)\}/);
  assert.match(page, /onClick=\{followTotal\}>Use \{formatPeso\(previewFee\)\}/);
});

test("the completed-visit line shows the amount that was actually charged when the doctor typed none", () => {
  assert.equal((page.match(/booking\?\.totalFee \? String\(booking\.totalFee\)/g) ?? []).length, 2);
});

test("a Charge is only 'done' with an amount the server accepts (more than 0, at most 100,000)", () => {
  assert.match(page, /Number\(pfAmountShown\) > 0 && Number\(pfAmountShown\) <= 100_000/);
});
//JJQR - END

//JJQR - AI (Nov 21, 2026) - the amount updates BY ITSELF when the fee changes (certificate, discount, visit type): it never asks, and the doctor can still edit it before completing
test("changing anything that affects the fee drops a typed amount so the amount follows the new total", () => {
  assert.match(page, /const followTotal = \(\) => \{ setPfAmount\(""\); setPfAmountEdited\(false\); setPfOverrideBase\(undefined\); \};/);
  // discount select, both visit-type toggles, the certificate checkbox, issuing and removing a certificate
  assert.match(page, /setDiscountCategory\(e\.target\.value as "Senior" \| "PWD" \| ""\); followTotal\(\);/);
  assert.equal((page.match(/setVisitType\(vt\); followTotal\(\);/g) ?? []).length, 2);
  assert.match(page, /setMedCertManual\(e\.target\.checked\); followTotal\(\);/);
  assert.match(page, /setCertExists\(true\);\s*followTotal\(\);/);
  assert.match(page, /setMedCertManual\(null\);[^\n]*\n\s*followTotal\(\);/);
});

test("a typed amount is also dropped when the computed total changes underneath it (e.g. the certificate fields are filled in)", () => {
  assert.match(page, /if \(pfAmountEdited && pfOverrideBase != null && previewFee !== null && previewFee !== pfOverrideBase\) \{\s*setPfAmount\(""\);\s*setPfAmountEdited\(false\);\s*setPfOverrideBase\(undefined\);\s*\}/);
});

test("opening a visit never wipes a saved amount: the base is only recorded when the doctor types", () => {
  assert.equal((page.match(/setPfOverrideBase\(previewFee\)/g) ?? []).length, 1);
});

test("the certificate is a real checkbox: ticked by itself (follows the certificate), honours the front desk's request, and shows the fee", () => {
  assert.match(page, /const \[medCertManual, setMedCertManual\] = useState<boolean \| null>\(null\);/);
  assert.match(page, /setMedCertManual\(realBooking\.medCertRequested \? true : null\)/);
  assert.match(page, /<span>Medical certificate \+\{formatPeso\(feeSchedule\?\.medCert \?\? 50\)\}<\/span>/);
});
//JJQR - END
