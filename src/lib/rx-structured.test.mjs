//JJQR - AI (Nov 20, 2026)
import test from "node:test";
import assert from "node:assert/strict";
import {
  RX_SLOT_LABELS,
  timingToSlots,
  slotsToTiming,
  suggestFromSig,
  prefillItem,
  asNeededFromWire,
  asNeededToWire,
} from "./rx-structured.ts";

test("RX_SLOT_LABELS canonical paper-pad order", () => {
  assert.deepEqual([...RX_SLOT_LABELS], ["Breakfast", "Lunch", "Dinner", "Bedtime"]);
});

test("timingToSlots: canonical order, ignores unknown, empty -> []", () => {
  assert.deepEqual(timingToSlots(null), []);
  assert.deepEqual(timingToSlots(undefined), []);
  assert.deepEqual(timingToSlots(""), []);
  assert.deepEqual(timingToSlots("   "), []);
  assert.deepEqual(timingToSlots("Bedtime, Breakfast, Lunch"), ["Breakfast", "Lunch", "Bedtime"]);
  assert.deepEqual(timingToSlots("breakfast,snack,dinner"), ["Breakfast", "Dinner"]);
  assert.deepEqual(timingToSlots("Dinner"), ["Dinner"]);
});

test("slotsToTiming: canonical order, ', ' joined, null when empty", () => {
  assert.equal(slotsToTiming([]), null);
  assert.equal(slotsToTiming(["snack"]), null);
  assert.equal(slotsToTiming(["Bedtime", "Breakfast"]), "Breakfast, Bedtime");
  assert.equal(slotsToTiming(["Dinner", "Lunch", "Breakfast", "Bedtime"]), "Breakfast, Lunch, Dinner, Bedtime");
  assert.equal(slotsToTiming(["Lunch"]), "Lunch");
});

test("suggestFromSig: PO 1 tab TID after meals", () => {
  const got = suggestFromSig({ instruction: "PO 1 tab TID after meals", route: "PO" });
  assert.equal(got.meal, "After");
  assert.deepEqual(got.slots, ["Breakfast", "Lunch", "Dinner"]);
  assert.equal(got.asNeeded, false);
});

test("suggestFromSig: Jessie's 4 meds", () => {
  const loperamide = suggestFromSig({
    instruction: "PO 2 mg after each loose stool; max 8 mg/day x 2 days (avoid if bloody stool/fever)",
    route: "PO",
  });
  assert.equal(loperamide.asNeeded, true);
  assert.deepEqual(loperamide.slots, []);
  assert.equal(loperamide.meal, null);

  const ascorbic = suggestFromSig({ instruction: "PO 1 tab once daily x 30 days", route: "PO" });
  assert.deepEqual(ascorbic.slots, ["Breakfast"]);
  assert.equal(ascorbic.meal, null);
  assert.equal(ascorbic.asNeeded, false);

  const ors = suggestFromSig({ instruction: "dissolve in 1 L clean water; sip frequently x 2-3 days" });
  assert.equal(ors.meal, null);
  assert.deepEqual(ors.slots, []);
  assert.equal(ors.asNeeded, false);

  const amlo = suggestFromSig({ instruction: "once daily ongoing; take same time each day" });
  assert.deepEqual(amlo.slots, ["Breakfast"]);
  assert.equal(amlo.meal, null);
  assert.equal(amlo.asNeeded, false);
});

test("prefillItem: fills unset fields for TID after meals", () => {
  const got = prefillItem({ instruction: "PO 1 tab TID after meals", route: "PO" });
  assert.equal(got.mealRelation, "After");
  assert.equal(got.timing, "Breakfast, Lunch, Dinner");
  assert.equal(got.asNeeded, false);
});

test("prefillItem: does not overwrite manual Before/After, times, or asNeeded=false", () => {
  const meal = prefillItem({
    instruction: "after meals",
    mealRelation: "Before",
  });
  assert.equal(meal.mealRelation, "Before");

  const times = prefillItem({
    instruction: "TID after meals",
    timing: "Bedtime",
  });
  assert.equal(times.timing, "Bedtime");
  assert.equal(times.mealRelation, "After");

  const prnOff = prefillItem({
    instruction: "PRN for pain",
    asNeeded: false,
  });
  assert.equal(prnOff.asNeeded, false);
});

test("prefillItem: asNeeded true and empty timing stays empty", () => {
  const got = prefillItem({
    instruction: "PO 2 mg after each loose stool; max 8 mg/day x 2 days (avoid if bloody stool/fever)",
    route: "PO",
  });
  assert.equal(got.asNeeded, true);
  assert.ok(!got.timing);
  assert.equal(got.mealRelation, null);
});

test("prefillItem: Jessie's 4 meds", () => {
  const loperamide = prefillItem({
    instruction: "PO 2 mg after each loose stool; max 8 mg/day x 2 days (avoid if bloody stool/fever)",
    route: "PO",
  });
  assert.equal(loperamide.asNeeded, true);
  assert.ok(!loperamide.timing);
  assert.equal(loperamide.mealRelation, null);

  const ascorbic = prefillItem({ instruction: "PO 1 tab once daily x 30 days", route: "PO" });
  assert.equal(ascorbic.timing, "Breakfast");
  assert.equal(ascorbic.asNeeded, false);
  assert.equal(ascorbic.mealRelation, null);

  const ors = prefillItem({ instruction: "dissolve in 1 L clean water; sip frequently x 2-3 days" });
  assert.equal(ors.mealRelation, null);
  assert.ok(!ors.timing);
  assert.equal(ors.asNeeded, false);

  const amlo = prefillItem({ instruction: "once daily ongoing; take same time each day" });
  assert.equal(amlo.timing, "Breakfast");
  assert.equal(amlo.asNeeded, false);
  assert.equal(amlo.mealRelation, null);
});

test("prefillItem: returns a new object", () => {
  const item = { instruction: "once daily", mealRelation: null, timing: null, asNeeded: null };
  const got = prefillItem(item);
  assert.notEqual(got, item);
  assert.equal(item.timing, null);
  assert.equal(got.timing, "Breakfast");
});

test("wire helpers: boolean passes through, otherwise null", () => {
  assert.equal(asNeededFromWire(true), true);
  assert.equal(asNeededFromWire(false), false);
  assert.equal(asNeededFromWire(null), null);
  assert.equal(asNeededFromWire(undefined), null);
  assert.equal(asNeededToWire(true), true);
  assert.equal(asNeededToWire(false), false);
  assert.equal(asNeededToWire(null), null);
  assert.equal(asNeededToWire(undefined), null);
});
//JJQR - END
