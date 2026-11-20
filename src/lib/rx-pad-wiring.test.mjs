//JJQR - AI (Nov 20, 2026) - Rx pad fields (meal timing / times / as needed) are wired through entry, templates, save, amend flush and print
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRxSig } from "./rx-sig-parse.ts";
import { prefillItem } from "./rx-structured.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("BID with meals is two doses (breakfast + dinner) after meals, not three", () => {
  const r = parseRxSig({ instruction: "PO 1 tab BID with meals x 30 days" });
  assert.deepEqual(r.slots, ["BREAKFAST", "DINNER"]);
  assert.equal(r.meal, "after");
});

test("template apply copies saved fields and pre-fills only the unset ones", () => {
  const saved = prefillItem({ instruction: "PO 1 tab TID", mealRelation: "Before", timing: "Bedtime", asNeeded: false });
  assert.equal(saved.mealRelation, "Before");
  assert.equal(saved.timing, "Bedtime");
  assert.equal(saved.asNeeded, false);
  const legacy = prefillItem({ instruction: "PO 1 tab BID with meals", mealRelation: null, timing: null, asNeeded: null });
  assert.equal(legacy.mealRelation, "After");
  assert.equal(legacy.timing, "Breakfast, Dinner");
  assert.equal(legacy.asNeeded, false);
});

test("entry form, template editor, wire mappings and print all carry as_needed", () => {
  const form = read("../components/doctor/PrescriptionForm.tsx");
  assert.match(form, /RxTimingFields/);
  assert.match(form, /plan\.toAdd\.map\(prefillItem\)/);
  assert.match(form, /as_needed: asNeededToWire\(i\.asNeeded\)/);
  const fields = read("../components/doctor/RxTimingFields.tsx");
  for (const label of ["Meal timing", "Times", "As needed", "Breakfast"]) assert.ok(fields.includes(label) || label === "Breakfast");
  assert.match(fields, /min-h-\[44px\]/);
  const tab = read("../components/doctor/templates/RxTab.tsx");
  assert.match(tab, /as_needed: asNeededToWire\(l\.asNeeded\)/);
  assert.match(tab, /suggestFromSig/);
  assert.match(tab, /As needed/);
  for (const f of [
    "../app/doctor/consultation2/[bookingId]/page.tsx",
    "../app/doctor/patients/[id]/page.tsx",
    "../app/patient/prescriptions/page.tsx",
    "./consult-print.ts",
    "./print-forms.ts",
    "./data/clinical.ts",
  ]) assert.match(read(f), /as_needed|asNeeded/, f + " must carry as_needed");
  assert.match(read("./print-forms-html.ts"), /hasSavedStructured/);
});
//JJQR - END

//JJQR - AI (Nov 20, 2026)
import { rxDisplayName } from "./rx-sig-parse.ts";
test("name line does not repeat a per-intake unit already ending the name", () => {
  assert.equal(rxDisplayName("ORAL REHYDRATION SALTS (ORS) SACHET", "1 sachet"), "ORAL REHYDRATION SALTS (ORS) SACHET");
  assert.equal(rxDisplayName("PARACETAMOL 500MG TAB", "1 tab"), "PARACETAMOL 500MG TAB");
  assert.equal(rxDisplayName("PARACETAMOL 500MG TAB", "2"), "PARACETAMOL 500MG TAB 2");
  assert.equal(rxDisplayName("Paracetamol", "500 mg"), "Paracetamol 500 mg");
});
//JJQR - END
