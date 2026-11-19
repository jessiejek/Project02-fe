//JJQR - AI (Nov 19, 2026) - new file: deep links from consultation2 into /doctor/templates (Phase 2 page reads ?tab=&field=)
export type TemplatesTab = "soap" | "phrases" | "rx" | "favorites" | "diagnoses" | "certificates";

export function manageTemplatesHref(tab: TemplatesTab, field?: string): string {
  const q = new URLSearchParams({ tab });
  if (field) q.set("field", field);
  return `/doctor/templates?${q.toString()}`;
}
//JJQR - END
