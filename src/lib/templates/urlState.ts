//JJQR - AI (Nov 19, 2026) - new file: /doctor/templates deep links (?tab=&field=&id=). The URL is the single source of truth for tab / open item.
export const TEMPLATE_TABS = ["soap", "phrases", "rx", "favorites", "diagnoses", "certificates"] as const;
export type TemplateTab = (typeof TEMPLATE_TABS)[number];

export const TAB_LABELS: Record<TemplateTab, string> = {
  soap: "SOAP",
  phrases: "Phrases",
  rx: "Prescriptions",
  favorites: "Favorites",
  diagnoses: "Diagnoses",
  certificates: "Certificates",
};

/** DB enum casing — what the API stores for soap_phrases.field. */
export const PHRASE_FIELDS = [
  { value: "ChiefComplaint", label: "Chief complaint" },
  { value: "Subjective", label: "Subjective" },
  { value: "Objective", label: "Objective" },
  { value: "Assessment", label: "Assessment" },
  { value: "Plan", label: "Plan" },
] as const;
export type PhraseField = (typeof PHRASE_FIELDS)[number]["value"];

const TAB_ALIASES: Record<string, TemplateTab> = {
  prescriptions: "rx",
  prescription: "rx",
  "rx-templates": "rx",
  "med-certs": "certificates",
  "med-cert": "certificates",
  certs: "certificates",
  certificate: "certificates",
  diagnosis: "diagnoses",
  phrase: "phrases",
  favorite: "favorites",
  favourites: "favorites",
};

export function parseTab(v: string | null | undefined): TemplateTab {
  const t = (v ?? "").trim().toLowerCase();
  if ((TEMPLATE_TABS as readonly string[]).includes(t)) return t as TemplateTab;
  return TAB_ALIASES[t] ?? "soap";
}

/** Accepts "Plan", "plan", "chiefComplaint", "chief_complaint", "ChiefComplaint"… → DB casing, or null. */
export function parseField(v: string | null | undefined): PhraseField | null {
  const t = (v ?? "").trim().toLowerCase().replace(/[_\s-]/g, "");
  return PHRASE_FIELDS.find((f) => f.value.toLowerCase() === t)?.value ?? null;
}

export function phraseFieldLabel(value: string): string {
  return PHRASE_FIELDS.find((f) => f.value === value)?.label ?? value;
}

export function buildTemplatesUrl(opts: { tab: TemplateTab; field?: string | null; id?: string | null }): string {
  const q = new URLSearchParams({ tab: opts.tab });
  if (opts.field) q.set("field", opts.field);
  if (opts.id) q.set("id", opts.id);
  return `/doctor/templates?${q.toString()}`;
}
//JJQR - END
