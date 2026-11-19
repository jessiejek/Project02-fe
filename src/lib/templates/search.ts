//JJQR - AI (Nov 19, 2026) - new file: client-side search over the already-loaded template lists (global "All tabs" search + per-tab filter)
import type { TemplateTab } from "./urlState";

export interface SearchHit {
  tab: TemplateTab;
  id: string;
  title: string;
  snippet: string;
  /** phrases only: DB field casing, so a hit can deep-link to the right section */
  field?: string;
}

export interface SearchLibrary {
  soap: { id: string; title: string; chief_complaint?: string | null; subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null }[];
  phrases: { id: string; field: string; label: string; body: string }[];
  rx: { template_id: string; title: string; prescription_template_items: { generic_name: string; dosage?: string; instruction?: string | null; indication?: string | null }[] }[];
  favorites: { id: string; generic_name: string; dosage?: string; instruction?: string | null }[];
  diagnoses: { id: string; label: string; body: string; icd10_code?: string | null }[];
  certificates: { id: string; title: string; diagnosis_text?: string | null; recommendations?: string | null; purpose_exception?: string | null }[];
}

export const normalize = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Every whitespace-separated term must appear somewhere in the combined text. Empty query matches everything. */
export function matchesQuery(query: string, ...texts: (string | null | undefined)[]): boolean {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const hay = normalize(texts.filter(Boolean).join(" "));
  return terms.every((t) => hay.includes(t));
}

export function snippet(text: string | null | undefined, max = 110): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function searchAll(query: string, lib: SearchLibrary, limitPerTab = 50): Record<TemplateTab, SearchHit[]> {
  const out: Record<TemplateTab, SearchHit[]> = { soap: [], phrases: [], rx: [], favorites: [], diagnoses: [], certificates: [] };
  if (normalize(query) === "") return out;
  const cap = (a: SearchHit[]) => a.slice(0, limitPerTab);
  out.soap = cap(lib.soap
    .filter((t) => matchesQuery(query, t.title, t.chief_complaint, t.subjective, t.objective, t.assessment, t.plan))
    .map((t) => ({ tab: "soap" as const, id: t.id, title: t.title, snippet: snippet(t.chief_complaint || t.subjective || t.assessment || t.plan || t.objective) })));
  out.phrases = cap(lib.phrases
    .filter((p) => matchesQuery(query, p.label, p.body))
    .map((p) => ({ tab: "phrases" as const, id: p.id, title: p.label, snippet: snippet(p.body), field: p.field })));
  out.rx = cap(lib.rx
    .filter((t) => matchesQuery(query, t.title, ...t.prescription_template_items.flatMap((i) => [i.generic_name, i.dosage, i.instruction, i.indication])))
    .map((t) => ({ tab: "rx" as const, id: t.template_id, title: t.title, snippet: snippet(t.prescription_template_items.map((i) => i.generic_name).join(", ")) })));
  out.favorites = cap(lib.favorites
    .filter((f) => matchesQuery(query, f.generic_name, f.dosage, f.instruction))
    .map((f) => ({ tab: "favorites" as const, id: f.id, title: f.generic_name, snippet: snippet([f.dosage, f.instruction].filter(Boolean).join(" · ")) })));
  out.diagnoses = cap(lib.diagnoses
    .filter((d) => matchesQuery(query, d.label, d.body, d.icd10_code))
    .map((d) => ({ tab: "diagnoses" as const, id: d.id, title: d.label, snippet: snippet([d.icd10_code, d.body].filter(Boolean).join(" · ")) })));
  out.certificates = cap(lib.certificates
    .filter((c) => matchesQuery(query, c.title, c.diagnosis_text, c.recommendations, c.purpose_exception))
    .map((c) => ({ tab: "certificates" as const, id: c.id, title: c.title, snippet: snippet(c.diagnosis_text || c.recommendations || c.purpose_exception) })));
  return out;
}

export function totalHits(h: Record<TemplateTab, SearchHit[]>): number {
  return Object.values(h).reduce((n, a) => n + a.length, 0);
}
//JJQR - END
