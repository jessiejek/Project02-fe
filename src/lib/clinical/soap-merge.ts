//JJQR - AI (Nov 19, 2026) - new file: pure helpers for applying a SOAP template (Replace / Append) without ever wiping text
export const SOAP_KEYS = ["chiefComplaint", "subjective", "objective", "assessment", "plan"] as const;
export type SoapKey = (typeof SOAP_KEYS)[number];
export type SoapValues = Record<SoapKey, string>;
export type SoapTemplateValues = Partial<Record<SoapKey, string | null | undefined>>;
export type SoapApplyMode = "replace" | "append";
/** What happens to one field when the template is applied. */
export type SoapFieldOutcome = "filled" | "replaced" | "appended" | "kept-template-blank" | "unchanged";

export const SOAP_FIELD_LABELS: Record<SoapKey, string> = {
  chiefComplaint: "Chief complaint",
  subjective: "Subjective",
  objective: "Objective",
  assessment: "Assessment",
  plan: "Plan",
};

const isBlank = (s: string | null | undefined) => !s || s.trim() === "";

export function emptySoap(): SoapValues {
  return { chiefComplaint: "", subjective: "", objective: "", assessment: "", plan: "" };
}

export function hasSoapContent(values: SoapTemplateValues): boolean {
  return SOAP_KEYS.some((k) => !isBlank(values[k]));
}

export function soapEqual(a: SoapValues, b: SoapValues): boolean {
  return SOAP_KEYS.every((k) => a[k] === b[k]);
}

/** Merge one field. A blank template field NEVER changes the doctor's text. */
export function mergeSoapField(current: string, templateText: string | null | undefined, mode: SoapApplyMode): { value: string; outcome: SoapFieldOutcome } {
  if (isBlank(templateText)) return { value: current, outcome: "kept-template-blank" };
  const tpl = (templateText as string).trim();
  if (isBlank(current)) return { value: tpl, outcome: "filled" };
  if (mode === "replace") return current.trim() === tpl ? { value: current, outcome: "unchanged" } : { value: tpl, outcome: "replaced" };
  // Append: skip if the exact template text is already in the note, otherwise add it on a new line.
  if (current.includes(tpl)) return { value: current, outcome: "unchanged" };
  return { value: `${current.replace(/\s+$/, "")}\n${tpl}`, outcome: "appended" };
}

export function mergeSoapTemplate(current: SoapValues, template: SoapTemplateValues, mode: SoapApplyMode): { values: SoapValues; outcomes: Record<SoapKey, SoapFieldOutcome> } {
  const values = emptySoap();
  const outcomes = {} as Record<SoapKey, SoapFieldOutcome>;
  for (const k of SOAP_KEYS) {
    const r = mergeSoapField(current[k] ?? "", template[k], mode);
    values[k] = r.value;
    outcomes[k] = r.outcome;
  }
  return { values, outcomes };
}
//JJQR - END

//JJQR - AI (Nov 19, 2026) - apply preview: which part of the merged text is NEW (shown green) and which is the doctor's existing text
export function splitAddedText(current: string, merged: string, outcome: SoapFieldOutcome): { kept: string; added: string } {
  if (outcome === "unchanged" || outcome === "kept-template-blank") return { kept: merged, added: "" };
  if (outcome === "appended" && current.trim() !== "" && merged.startsWith(current)) {
    return { kept: current, added: merged.slice(current.length) };
  }
  return { kept: "", added: merged };
}
//JJQR - END
