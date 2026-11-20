//JJQR - AI (Nov 20, 2026)
import test from "node:test";
import assert from "node:assert/strict";
import { parseRxSig, rxDisplayName } from "./rx-sig-parse.ts";

function sig(instruction, extra = {}) {
  return parseRxSig({ instruction, ...extra });
}

function assertSig(input, expected, label) {
  const got = parseRxSig(input);
  assert.deepEqual(got, expected, label || JSON.stringify(input));
}

const B = "BREAKFAST";
const L = "LUNCH";
const D = "DINNER";
const N = "BEDTIME";

test("parseRxSig meal: structured Before/After wins over text", () => {
  assertSig(
    { instruction: "after meals", mealRelation: "Before" },
    { meal: "before", slots: [B, L, D], asNeeded: false, asDirected: false },
  );
  assertSig(
    { instruction: "before meals", mealRelation: "After" },
    { meal: "after", slots: [B, L, D], asNeeded: false, asDirected: false },
  );
  assertSig(
    { instruction: "once daily", mealRelation: "AFTER" },
    { meal: "after", slots: [B], asNeeded: false, asDirected: false },
  );
});

test("parseRxSig meal: before patterns from text", () => {
  const beforeCases = [
    "take before meals",
    "before meal",
    "before eating",
    "before food",
    "before breakfast",
    "before lunch",
    "before dinner",
    "before supper",
    "ac",
    "a.c.",
    "on an empty stomach",
    "30 min before",
    "30 mins before",
    "30 minutes before",
    "30min before",
    "1 hour before",
  ];
  for (const instruction of beforeCases) {
    const got = sig(instruction);
    assert.equal(got.meal, "before", instruction);
    assert.equal(got.asNeeded, false, instruction);
  }
});

test("parseRxSig meal: after patterns from text", () => {
  const afterCases = [
    "after meals",
    "after meal",
    "after eating",
    "after food",
    "after breakfast",
    "after lunch",
    "after dinner",
    "after supper",
    "pc",
    "p.c.",
    "with food",
    "with meal",
    "with meals",
    "with breakfast",
    "taken with food",
    "after each meal",
  ];
  for (const instruction of afterCases) {
    const got = sig(instruction);
    assert.equal(got.meal, "after", instruction);
    assert.equal(got.asNeeded, false, instruction);
  }
});

test("parseRxSig meal: after each loose stool / bowel movement / vomiting are not meals", () => {
  assert.equal(sig("after each loose stool").meal, null);
  assert.equal(sig("after each bowel movement").meal, null);
  assert.equal(sig("after vomiting").meal, null);
  assert.equal(sig("PO 2 mg after each loose stool; max 8 mg/day").meal, null);
});

test("parseRxSig meal: both before and after -> null; neither -> null", () => {
  assert.equal(sig("before meals and after meals").meal, null);
  assert.equal(sig("ac pc").meal, null);
  assert.equal(sig("before food after food").meal, null);
  assert.equal(sig("").meal, null);
  assert.equal(parseRxSig({}).meal, null);
});

test("parseRxSig slots: structured timing wins and keeps order/dedupe", () => {
  assert.deepEqual(
    parseRxSig({ instruction: "once daily", timing: "Dinner,Breakfast,Breakfast" }).slots,
    [B, D],
  );
  assert.deepEqual(
    parseRxSig({ instruction: "TID", timing: "Bedtime" }).slots,
    [N],
  );
  assert.deepEqual(
    parseRxSig({ instruction: "as needed", timing: "Breakfast,Dinner" }).slots,
    [B, D],
  );
  assert.equal(parseRxSig({ instruction: "as needed", timing: "Breakfast,Dinner" }).asNeeded, true);
});

test("parseRxSig slots: structured empty falls back to text", () => {
  assert.deepEqual(parseRxSig({ instruction: "once daily", timing: "" }).slots, [B]);
  assert.deepEqual(parseRxSig({ instruction: "BID", timing: null }).slots, [B, D]);
});

test("parseRxSig slots: once daily / OD / QD / daily -> BREAKFAST", () => {
  const once = [
    "once daily",
    "once a day",
    "OD",
    "QD",
    "qd",
    "1x/day",
    "1x a day",
    "1 x / day",
    "daily",
    "every day",
    "every 24 hours",
    "q24h",
  ];
  for (const instruction of once) {
    assert.deepEqual(sig(instruction).slots, [B], instruction);
  }
});

test("parseRxSig slots: once daily at night/bedtime/hs -> BEDTIME", () => {
  assert.deepEqual(sig("once daily at night").slots, [N]);
  assert.deepEqual(sig("once daily bedtime").slots, [N]);
  assert.deepEqual(sig("once daily hs").slots, [N]);
  assert.deepEqual(sig("once daily qhs").slots, [N]);
  assert.deepEqual(sig("once daily h.s.").slots, [N]);
  assert.deepEqual(sig("once daily before sleep").slots, [N]);
  assert.deepEqual(sig("once daily at bed").slots, [N]);
  assert.deepEqual(sig("HS").slots, [N]);
  assert.deepEqual(sig("bedtime").slots, [N]);
  assert.deepEqual(sig("at night").slots, [N]);
});

test("parseRxSig slots: BID / twice daily / q12h -> BREAKFAST+DINNER", () => {
  const bid = [
    "BID",
    "twice daily",
    "twice a day",
    "2x/day",
    "two times a day",
    "every 12 hours",
    "q12h",
  ];
  for (const instruction of bid) {
    assert.deepEqual(sig(instruction).slots, [B, D], instruction);
  }
});

test("parseRxSig slots: TID / thrice / q8h -> BREAKFAST,LUNCH,DINNER", () => {
  const tid = ["TID", "thrice", "three times", "3x/day", "every 8 hours", "q8h"];
  for (const instruction of tid) {
    assert.deepEqual(sig(instruction).slots, [B, L, D], instruction);
  }
});

test("parseRxSig slots: QID / q6h / q4h -> all four", () => {
  const qid = ["QID", "four times", "4x/day", "every 6 hours", "q6h", "q4h", "every 4 hours"];
  for (const instruction of qid) {
    assert.deepEqual(sig(instruction).slots, [B, L, D, N], instruction);
  }
});

test("parseRxSig slots: explicit mentions and meal-frequency phrases", () => {
  assert.deepEqual(sig("morning and evening").slots, [B, D]);
  assert.deepEqual(sig("morning, noon and night").slots, [B, L, N]);
  assert.deepEqual(sig("every meal").slots, [B, L, D]);
  assert.deepEqual(sig("each meal").slots, [B, L, D]);
  assert.deepEqual(sig("with meals").slots, [B, L, D]);
  assert.deepEqual(sig("after meals").slots, [B, L, D]);
  assert.deepEqual(sig("before meals").slots, [B, L, D]);
  assert.deepEqual(sig("three meals").slots, [B, L, D]);
  assert.deepEqual(sig("umaga").slots, [B]);
  assert.deepEqual(sig("tanghali").slots, [L]);
  assert.deepEqual(sig("8 am").slots, [B]);
  assert.deepEqual(sig("8am").slots, [B]);
  assert.equal(sig("gabi").slots.includes(D), false);
  assert.deepEqual(sig("I am taking this").slots, []);
});

test("parseRxSig asNeeded: PRN / as needed / loose stool / stat -> no slots", () => {
  const needed = [
    "PRN",
    "prn",
    "p.r.n.",
    "p.r.n",
    "as needed",
    "when needed",
    "if needed",
    "when necessary",
    "if necessary",
    "sos",
    "after each loose stool",
    "each loose stool",
    "each bowel movement",
    "stat",
    "for fever",
    "for pain",
  ];
  for (const instruction of needed) {
    const got = sig(instruction);
    assert.equal(got.asNeeded, true, instruction);
    assert.deepEqual(got.slots, [], instruction);
    assert.equal(got.asDirected, false, instruction);
  }
  const morningPrn = sig("take in the morning as needed");
  assert.equal(morningPrn.asNeeded, true);
  assert.deepEqual(morningPrn.slots, []);
  const feverDaily = sig("for fever once daily");
  assert.equal(feverDaily.asNeeded, false);
  assert.deepEqual(feverDaily.slots, [B]);
  const painBid = sig("for pain BID");
  assert.equal(painBid.asNeeded, false);
  assert.deepEqual(painBid.slots, [B, D]);
});

test("parseRxSig: durations are not frequency; food/good do not trigger od/ac", () => {
  assert.deepEqual(sig("x 30 days").slots, []);
  assert.equal(sig("x 30 days").asDirected, true);
  assert.deepEqual(sig("x 2-3 days").slots, []);
  assert.deepEqual(sig("for 7 days").slots, []);
  assert.equal(sig("for 7 days").asNeeded, false);
  const food = sig("food");
  assert.deepEqual(food.slots, []);
  assert.equal(food.meal, null);
  const good = sig("good");
  assert.deepEqual(good.slots, []);
  assert.equal(good.meal, null);
  const withFood = sig("take with food");
  assert.equal(withFood.meal, "after");
  assert.notEqual(withFood.meal, "before");
});

test("parseRxSig asDirected: non-empty text, no slots, not asNeeded", () => {
  const ors = sig("dissolve in 1 L clean water; sip frequently x 2-3 days");
  assert.deepEqual(ors.slots, []);
  assert.equal(ors.asNeeded, false);
  assert.equal(ors.asDirected, true);
  const empty = parseRxSig({});
  assert.equal(empty.asDirected, false);
  assert.deepEqual(empty.slots, []);
  assert.equal(empty.asNeeded, false);
  assert.equal(sig("   ").asDirected, false);
});

test("parseRxSig: ongoing / maintenance / same time each day do not block frequency", () => {
  assert.deepEqual(sig("once daily ongoing; take same time each day").slots, [B]);
  assert.deepEqual(sig("once daily maintenance").slots, [B]);
});

test("rxDisplayName: drop duplicated strength/form; keep intake amounts", () => {
  assert.equal(rxDisplayName("LOPERAMIDE 2MG CAP", "2 mg cap"), "LOPERAMIDE 2MG CAP");
  assert.equal(rxDisplayName("AMLODIPINE 5MG TAB", "5 mg tab"), "AMLODIPINE 5MG TAB");
  assert.equal(
    rxDisplayName("ASCORBIC ACID + MULTIVITAMINS 500MG TAB", "500 mg tab"),
    "ASCORBIC ACID + MULTIVITAMINS 500MG TAB",
  );
  assert.equal(rxDisplayName("Paracetamol", "500 mg"), "Paracetamol 500 mg");
  assert.equal(rxDisplayName("PARACETAMOL 500MG TAB", "2"), "PARACETAMOL 500MG TAB 2");
  assert.equal(rxDisplayName("AMLODIPINE 5MG", "5 mg tab"), "AMLODIPINE 5MG tab");
  assert.equal(rxDisplayName("Paracetamol", ""), "Paracetamol");
  assert.equal(rxDisplayName("  LOPERAMIDE   2MG  CAP  ", "2 mg cap"), "LOPERAMIDE 2MG CAP");
});

test("Jessie's 4 real meds through parseRxSig + rxDisplayName", () => {
  const loperamide = parseRxSig({
    instruction: "PO 2 mg after each loose stool; max 8 mg/day x 2 days (avoid if bloody stool/fever)",
    route: "PO",
  });
  assert.deepEqual(loperamide.slots, []);
  assert.equal(loperamide.asNeeded, true);
  assert.equal(loperamide.meal, null);
  assert.equal(loperamide.asDirected, false);
  assert.equal(rxDisplayName("LOPERAMIDE 2MG CAP", "2 mg cap"), "LOPERAMIDE 2MG CAP");

  const ascorbic = parseRxSig({
    instruction: "PO 1 tab once daily x 30 days",
    route: "PO",
  });
  assert.deepEqual(ascorbic.slots, [B]);
  assert.equal(ascorbic.meal, null);
  assert.equal(ascorbic.asNeeded, false);
  assert.equal(rxDisplayName("ASCORBIC ACID + MULTIVITAMINS 500MG TAB", "500 mg tab"), "ASCORBIC ACID + MULTIVITAMINS 500MG TAB");

  const ors = parseRxSig({
    instruction: "dissolve in 1 L clean water; sip frequently x 2-3 days",
  });
  assert.deepEqual(ors.slots, []);
  assert.equal(ors.asNeeded, false);
  assert.equal(ors.asDirected, true);
  assert.equal(rxDisplayName("ORAL REHYDRATION SALTS", ""), "ORAL REHYDRATION SALTS");

  const amlo = parseRxSig({
    instruction: "once daily ongoing; take same time each day",
  });
  assert.deepEqual(amlo.slots, [B]);
  assert.equal(amlo.meal, null);
  assert.equal(rxDisplayName("AMLODIPINE 5MG TAB", "5 mg tab"), "AMLODIPINE 5MG TAB");
});
//JJQR - END
