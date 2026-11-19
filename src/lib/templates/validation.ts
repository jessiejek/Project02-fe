//JJQR - AI (Nov 19, 2026) - new file: "why can't I save?" reasons for every template editor. null = OK to save.
const blank = (s: string | null | undefined) => !s || s.trim() === "";

export function validateSoapTemplate(v: { title: string; fields: (string | null | undefined)[] }): string | null {
  if (blank(v.title)) return "Give the template a name.";
  if (v.fields.every(blank)) return "Add text to at least one SOAP field.";
  return null;
}

export function validatePhrase(v: { label: string; body: string }): string | null {
  if (blank(v.label)) return "Give the phrase a name.";
  if (blank(v.body)) return "Add the phrase text.";
  if (v.label.trim().length > 200) return "Phrase name is too long (max 200 characters).";
  if (v.body.trim().length > 4000) return "Phrase text is too long (max 4000 characters).";
  return null;
}

export function validateRxTemplate(v: { title: string; items: { genericName: string }[] }): string | null {
  if (blank(v.title)) return "Give the prescription set a name.";
  if (!v.items.some((i) => !blank(i.genericName))) return "Add at least one medicine.";
  return null;
}

export function validateFavorite(v: { genericName: string }): string | null {
  if (blank(v.genericName)) return "Choose or type a medicine.";
  return null;
}

export function validateDiagnosis(v: { label: string; body: string }): string | null {
  if (blank(v.label)) return "Give the diagnosis a short label.";
  if (blank(v.body)) return "Add the diagnosis text.";
  return null;
}

export function validateCertTemplate(v: { title: string; fields: (string | null | undefined)[] }): string | null {
  if (blank(v.title)) return "Give the certificate template a name.";
  if (v.fields.every(blank)) return "Fill in at least one certificate field.";
  return null;
}
//JJQR - END
