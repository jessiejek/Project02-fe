//JJQR - AI (2026-11-25) - on-screen Sig line = the printed form's Sig line
import test from "node:test";
import assert from "node:assert/strict";
import { rxPreviewName, rxPreviewSig } from "./rx-preview.ts";
import { buildPrescriptionHtml } from "./print-forms-html.ts";

test("Sig shows route + instructions, not the strength", () => {
  const i = { genericName: "Paracetamol", dosage: "500mg", route: "PO", instruction: "1 tab every 6 hours" };
  assert.equal(rxPreviewSig(i), "PO 1 tab every 6 hours");
  assert.equal(rxPreviewName(i), "Paracetamol 500mg");
});

test("no route: instructions only; route already written in the instructions is not doubled", () => {
  assert.equal(rxPreviewSig({ genericName: "X", dosage: "5mg", instruction: "1 tab daily" }), "1 tab daily");
  assert.equal(rxPreviewSig({ genericName: "X", dosage: "5mg", route: "PO", instruction: "PO 1 tab daily" }), "PO 1 tab daily");
  assert.equal(rxPreviewSig({ genericName: "X", dosage: "5mg", route: "PO", instruction: "" }), "PO");
  assert.equal(rxPreviewSig({ genericName: "X", dosage: "5mg" }), "");
});

test("same text as the printed prescription", () => {
  const item = { generic_name: "Amoxicillin", dosage: "500mg", quantity: "21", route: "PO", instruction: "1 cap three times a day" };
  const html = buildPrescriptionHtml({
    clinic: { clinic_name: "C", address: "", contact_number: null },
    doctor: { full_name: "D", license_number: null, ptr_number: null },
    patient: { full_name: "P" },
    items: [item],
    date: "2026-11-25",
    origin: "http://forms.test",
  });
  const sig = rxPreviewSig({ genericName: item.generic_name, dosage: item.dosage, route: item.route, instruction: item.instruction });
  assert.ok(html.includes(sig), "printed form contains the preview Sig text");
  assert.ok(html.includes(rxPreviewName({ genericName: item.generic_name, dosage: item.dosage })), "printed form contains the preview name");
});
//JJQR - END
