//JJQR - AI (Oct 31, 2026)
export type Specialty = "General" | "Peds" | "OB" | "IM";

export type TemplateKind = "soap" | "diagnosis" | "rx" | "mc" | "phrase";

const SOAP_TITLE_TAGS: { match: RegExp; tags: Specialty[] }[] = [
  { match: /pediatric|peds|child|infant|uri/i, tags: ["Peds", "General"] },
  { match: /prenatal|anc|obstet|pregnancy|postpartum|labor/i, tags: ["OB"] },
  { match: /hypertension|diabetes|dm\b|cad|copd|asthma adult|internal/i, tags: ["IM", "General"] },
  { match: /uri|upper respiratory|pharyng/i, tags: ["General", "Peds"] },
];

const DIAGNOSIS_TAGS: { match: RegExp; tags: Specialty[] }[] = [
  { match: /pediatric|peds/i, tags: ["Peds"] },
  { match: /prenatal|obstet|pregnancy/i, tags: ["OB"] },
  { match: /hypertension|diabetes/i, tags: ["IM"] },
];

function tagsFromRules(title: string, rules: { match: RegExp; tags: Specialty[] }[]): Specialty[] {
  const out = new Set<Specialty>();
  for (const r of rules) {
    if (r.match.test(title)) r.tags.forEach((t) => out.add(t));
  }
  if (out.size === 0) out.add("General");
  return [...out];
}

export function tagTemplate(kind: TemplateKind, title: string): Specialty[] {
  const t = title.trim();
  if (!t) return ["General"];
  switch (kind) {
    case "soap":
      return tagsFromRules(t, SOAP_TITLE_TAGS);
    case "diagnosis":
      return tagsFromRules(t, DIAGNOSIS_TAGS);
    case "rx":
      return tagsFromRules(t, SOAP_TITLE_TAGS);
    case "mc":
      return tagsFromRules(t, SOAP_TITLE_TAGS);
    case "phrase":
      return tagsFromRules(t, SOAP_TITLE_TAGS);
    default:
      return ["General"];
  }
}

export function defaultSpecialtyFromDoctor(specialization: string): Specialty {
  const s = specialization.toLowerCase();
  if (s.includes("pediatr")) return "Peds";
  if (s.includes("obstet") || s.includes("gyn")) return "OB";
  if (s.includes("internal")) return "IM";
  if (s.includes("family")) return "General";
  return "General";
}

export function matchesSpecialtyFilter(kind: TemplateKind, title: string, filter: Specialty | "All"): boolean {
  if (filter === "All") return true;
  return tagTemplate(kind, title).includes(filter);
}

export const SPECIALTY_CHIP_LABELS: { id: Specialty | "All"; label: string }[] = [
  { id: "All", label: "All" },
  { id: "General", label: "General" },
  { id: "Peds", label: "Peds" },
  { id: "OB", label: "OB" },
  { id: "IM", label: "IM" },
];
//JJQR - END
