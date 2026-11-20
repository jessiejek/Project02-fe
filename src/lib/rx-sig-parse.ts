//JJQR - AI (Nov 20, 2026)
/**
 * Deterministic Rx sig parser for the A5 prescription printout.
 * Structured fields win; free-text is the fallback. No I/O, no DOM.
 */

export type RxSlot = "BREAKFAST" | "LUNCH" | "DINNER" | "BEDTIME";
export type RxMeal = "before" | "after" | null;

export interface RxSigInput {
  instruction?: string | null;
  route?: string | null;
  timing?: string | null;
  mealRelation?: string | null;
}

export interface RxSigResult {
  meal: RxMeal;
  slots: RxSlot[];
  asNeeded: boolean;
  asDirected: boolean;
}

const SLOT_ORDER: RxSlot[] = ["BREAKFAST", "LUNCH", "DINNER", "BEDTIME"];

const STRENGTH_TOKEN =
  /^\d+(?:\.\d+)?(?:mg(?:\/\d+(?:\.\d+)?ml)?|mcg|ml|iu|g|%)$/i;

const STRENGTH_PREFIX =
  /^\s*\d+(?:\.\d+)?\s*(?:mg(?:\s*\/\s*\d+(?:\.\d+)?\s*ml)?|mcg|ml|iu|g|%)\s*/i;

function combineText(instruction?: string | null, route?: string | null): string {
  const a = (instruction ?? "").trim();
  const b = (route ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  return a + " " + b;
}

function parseStructuredMeal(mealRelation?: string | null): RxMeal | undefined {
  const m = (mealRelation ?? "").trim().toLowerCase();
  if (m === "before" || m === "after") return m;
  return undefined;
}

function hasBeforeMeal(text: string): boolean {
  if (/\bbefore\s+meals?\b/i.test(text)) return true;
  if (/\bbefore\s+eating\b/i.test(text)) return true;
  if (/\bbefore\s+food\b/i.test(text)) return true;
  if (/\bbefore\s+(?:breakfast|lunch|dinner|supper)\b/i.test(text)) return true;
  if (/\ba\.c\./i.test(text)) return true;
  if (/\bac\b/i.test(text)) return true;
  if (/\bempty\s+stomach\b/i.test(text)) return true;
  if (/\d+\s*(?:min|mins|minutes)\s+before\b/i.test(text)) return true;
  if (/\b1\s+hour\s+before\b/i.test(text)) return true;
  return false;
}

function stripNonMealAfter(text: string): string {
  return text
    .replace(/\bafter\s+each\s+loose\s+stool\b/gi, " ")
    .replace(/\bafter\s+each\s+bowel\s+movement\b/gi, " ")
    .replace(/\bafter\s+vomiting\b/gi, " ");
}

function hasAfterMeal(text: string): boolean {
  const t = stripNonMealAfter(text);
  if (/\bafter\s+meals?\b/i.test(t)) return true;
  if (/\bafter\s+eating\b/i.test(t)) return true;
  if (/\bafter\s+food\b/i.test(t)) return true;
  if (/\bafter\s+(?:breakfast|lunch|dinner|supper)\b/i.test(t)) return true;
  if (/\bp\.c\./i.test(t)) return true;
  if (/\bpc\b/i.test(t)) return true;
  if (/\bwith\s+food\b/i.test(t)) return true;
  if (/\bwith\s+meals?\b/i.test(t)) return true;
  if (/\bwith\s+(?:breakfast|lunch|dinner|supper)\b/i.test(t)) return true;
  if (/\btaken\s+with\s+food\b/i.test(t)) return true;
  if (/\bafter\s+each\s+meal\b/i.test(t)) return true;
  return false;
}

function mealFromText(text: string): RxMeal {
  const before = hasBeforeMeal(text);
  const after = hasAfterMeal(text);
  if (before && after) return null;
  if (before) return "before";
  if (after) return "after";
  return null;
}

function parseStructuredSlots(timing?: string | null): RxSlot[] {
  const raw = (timing ?? "").trim();
  if (!raw) return [];
  const seen: { [k in RxSlot]?: boolean } = {};
  const parts = raw.split(",");
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim().toLowerCase();
    if (p === "breakfast") seen.BREAKFAST = true;
    else if (p === "lunch") seen.LUNCH = true;
    else if (p === "dinner") seen.DINNER = true;
    else if (p === "bedtime") seen.BEDTIME = true;
  }
  const out: RxSlot[] = [];
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    if (seen[SLOT_ORDER[i]]) out.push(SLOT_ORDER[i]);
  }
  return out;
}

function hasNightHint(text: string): boolean {
  if (/\bat\s+night\b/i.test(text)) return true;
  if (/\bnight\b/i.test(text)) return true;
  if (/\bbedtime\b/i.test(text)) return true;
  if (/\bqhs\b/i.test(text)) return true;
  if (/\bhs\b/i.test(text)) return true;
  if (/\bh\.s\./i.test(text)) return true;
  if (/\bbefore\s+sleep\b/i.test(text)) return true;
  if (/\bat\s+bed(?:time)?\b/i.test(text)) return true;
  return false;
}

function explicitSlotsFromText(text: string): RxSlot[] {
  const seen: { [k in RxSlot]?: boolean } = {};
  if (
    /\bevery\s+meal\b/i.test(text) ||
    /\beach\s+meal\b/i.test(text) ||
    /\bwith\s+meals?\b/i.test(text) ||
    /\bafter\s+meals?\b/i.test(text) ||
    /\bbefore\s+meals?\b/i.test(text) ||
    /\bthree\s+meals?\b/i.test(text)
  ) {
    seen.BREAKFAST = true;
    seen.LUNCH = true;
    seen.DINNER = true;
  }
  if (/\bmorning\b/i.test(text) || /\bbreakfast\b/i.test(text) || /\bumaga\b/i.test(text) || /\d\s*am\b/i.test(text)) {
    seen.BREAKFAST = true;
  }
  if (/\bnoon\b/i.test(text) || /\bmidday\b/i.test(text) || /\blunch\b/i.test(text) || /\btanghali\b/i.test(text)) {
    seen.LUNCH = true;
  }
  if (/\bevening\b/i.test(text) || /\bdinner\b/i.test(text) || /\bsupper\b/i.test(text)) {
    seen.DINNER = true;
  }
  if (hasNightHint(text)) {
    seen.BEDTIME = true;
  }
  const out: RxSlot[] = [];
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    if (seen[SLOT_ORDER[i]]) out.push(SLOT_ORDER[i]);
  }
  return out;
}

function detectFrequency(text: string): number {
  if (
    /\bqid\b/i.test(text) ||
    /\bfour\s+times\b/i.test(text) ||
    /\b4x\s*\/\s*day\b/i.test(text) ||
    /\b4\s*x\s*\/\s*day\b/i.test(text) ||
    /\bevery\s+6\s+hours?\b/i.test(text) ||
    /\bq6h\b/i.test(text) ||
    /\bq4h\b/i.test(text) ||
    /\bevery\s+4\s+hours?\b/i.test(text)
  ) {
    return 4;
  }
  if (
    /\btid\b/i.test(text) ||
    /\bthrice\b/i.test(text) ||
    /\bthree\s+times\b/i.test(text) ||
    /\b3x\s*\/\s*day\b/i.test(text) ||
    /\b3\s*x\s*\/\s*day\b/i.test(text) ||
    /\bevery\s+8\s+hours?\b/i.test(text) ||
    /\bq8h\b/i.test(text)
  ) {
    return 3;
  }
  if (
    /\bbid\b/i.test(text) ||
    /\btwice\s+daily\b/i.test(text) ||
    /\btwice\s+a\s+day\b/i.test(text) ||
    /\b2x\s*\/\s*day\b/i.test(text) ||
    /\b2\s*x\s*\/\s*day\b/i.test(text) ||
    /\btwo\s+times\s+a\s+day\b/i.test(text) ||
    /\bevery\s+12\s+hours?\b/i.test(text) ||
    /\bq12h\b/i.test(text)
  ) {
    return 2;
  }
  if (
    /\bonce\s+daily\b/i.test(text) ||
    /\bonce\s+a\s+day\b/i.test(text) ||
    /\bod\b/i.test(text) ||
    /\bqd\b/i.test(text) ||
    /\b1x\s*\/\s*day\b/i.test(text) ||
    /\b1\s*x\s*\/\s*day\b/i.test(text) ||
    /\b1x\s+a\s+day\b/i.test(text) ||
    /\b1\s*x\s+a\s+day\b/i.test(text) ||
    /\bdaily\b/i.test(text) ||
    /\bevery\s+day\b/i.test(text) ||
    /\bevery\s+24\s+hours?\b/i.test(text) ||
    /\bq24h\b/i.test(text)
  ) {
    return 1;
  }
  return 0;
}

function frequencyDefault(freq: number, text: string): RxSlot[] {
  if (freq === 1) return hasNightHint(text) ? ["BEDTIME"] : ["BREAKFAST"];
  if (freq === 2) return ["BREAKFAST", "DINNER"];
  if (freq === 3) return ["BREAKFAST", "LUNCH", "DINNER"];
  if (freq === 4) return ["BREAKFAST", "LUNCH", "DINNER", "BEDTIME"];
  return [];
}

function slotsFromText(text: string, freq: number): RxSlot[] {
  const explicit = explicitSlotsFromText(text);
  if (freq === 0 || explicit.length >= freq) {
    // "BID with meals" is a frequency plus a meal relation, not three explicit dose times.
    if (freq > 0 && explicit.length === 3 && !hasSpecificTimeWord(text)) return frequencyDefault(freq, text);
    return explicit;
  }
  return frequencyDefault(freq, text);
}

//JJQR - AI (Nov 20, 2026) - true only when the sig names an actual time of day (not just "with meals")
function hasSpecificTimeWord(text: string): boolean {
  return (
    /\b(?:morning|breakfast|umaga|noon|midday|lunch|tanghali|evening|dinner|supper)\b/i.test(text) ||
    /\d\s*am\b/i.test(text) ||
    hasNightHint(text)
  );
}

function detectAsNeeded(text: string, hasFreq: boolean): boolean {
  if (/\bprn\b/i.test(text)) return true;
  if (/\bp\.r\.n\.?/i.test(text)) return true;
  if (/\bas\s+needed\b/i.test(text)) return true;
  if (/\bwhen\s+needed\b/i.test(text)) return true;
  if (/\bif\s+needed\b/i.test(text)) return true;
  if (/\bwhen\s+necessary\b/i.test(text)) return true;
  if (/\bif\s+necessary\b/i.test(text)) return true;
  if (/\bsos\b/i.test(text)) return true;
  if (/\bafter\s+each\s+loose\s+stool\b/i.test(text)) return true;
  if (/\beach\s+loose\s+stool\b/i.test(text)) return true;
  if (/\beach\s+bowel\s+movement\b/i.test(text)) return true;
  if (/\bstat\b/i.test(text)) return true;
  if (!hasFreq && (/\bfor\s+fever\b/i.test(text) || /\bfor\s+pain\b/i.test(text))) return true;
  return false;
}

export function parseRxSig(input: RxSigInput): RxSigResult {
  const text = combineText(input.instruction, input.route);
  const structuredMeal = parseStructuredMeal(input.mealRelation);
  const meal = structuredMeal !== undefined ? structuredMeal : mealFromText(text);
  const structuredSlots = parseStructuredSlots(input.timing);
  const freq = detectFrequency(text);
  const asNeeded = detectAsNeeded(text, freq > 0);
  let slots: RxSlot[];
  if (structuredSlots.length > 0) {
    slots = structuredSlots;
  } else if (asNeeded) {
    slots = [];
  } else {
    slots = slotsFromText(text, freq);
  }
  const asDirected = !asNeeded && slots.length === 0 && text.length > 0;
  return { meal: meal, slots: slots, asNeeded: asNeeded, asDirected: asDirected };
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeForCompare(s: string): string {
  return collapseWs(s)
    .toLowerCase()
    .replace(/(\d)\s+(?=[a-z%])/gi, "$1");
}

function tokens(s: string): string[] {
  const t = normalizeForCompare(s);
  if (!t) return [];
  return t.split(" ");
}

function containsSeq(hay: string[], needle: string[]): boolean {
  if (!needle.length) return true;
  if (needle.length > hay.length) return false;
  for (let i = 0; i <= hay.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function everyTokenIn(needles: string[], hay: string[]): boolean {
  for (let i = 0; i < needles.length; i++) {
    let found = false;
    for (let j = 0; j < hay.length; j++) {
      if (hay[j] === needles[i]) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

function nameHasStrength(nameToks: string[], strength: string): boolean {
  for (let i = 0; i < nameToks.length; i++) {
    if (nameToks[i] === strength) return true;
  }
  return false;
}

function remainderAlreadyInName(remainder: string, nameToks: string[]): boolean {
  const rest = tokens(remainder);
  if (!rest.length) return true;
  return everyTokenIn(rest, nameToks);
}

export function rxDisplayName(genericName: string, dosage: string): string {
  const name = collapseWs(genericName);
  const dose = collapseWs(dosage);
  if (!dose) return name;
  const nameToks = tokens(name);
  const doseToks = tokens(dose);
  if (containsSeq(nameToks, doseToks) || everyTokenIn(doseToks, nameToks)) {
    return name;
  }
  if (doseToks.length && STRENGTH_TOKEN.test(doseToks[0]) && nameHasStrength(nameToks, doseToks[0])) {
    const rest = dose.replace(STRENGTH_PREFIX, "").trim();
    if (!rest || remainderAlreadyInName(rest, nameToks)) return name;
    return name + " " + rest;
  }
  //JJQR - AI (Nov 20, 2026) - per-intake amount like "1 sachet"/"1 tab" whose unit already ends the name ("... SACHET", "... 500MG TAB")
  const perIntake = /^\d+(?:\.\d+)?\s*([a-z]+)$/i.exec(dose);
  if (perIntake && nameToks.length > 1 && nameToks[nameToks.length - 1] === perIntake[1].toLowerCase()) {
    return name;
  }
  //JJQR - END
  return [genericName, dosage].filter(Boolean).join(" ");
}
//JJQR - END
