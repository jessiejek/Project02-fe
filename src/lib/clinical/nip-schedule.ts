//JJQR - AI (Oct 31, 2026)
export const NIP_SCHEDULE: { ageLabel: string; ageMonthsMin: number; vaccines: string[] }[] = [
  { ageLabel: "At birth", ageMonthsMin: 0, vaccines: ["BCG", "Hepatitis B (birth dose)"] },
  { ageLabel: "6 weeks", ageMonthsMin: 1.5, vaccines: ["Pentavalent (DPT-Hib-HepB) dose 1", "OPV dose 1", "PCV dose 1"] },
  { ageLabel: "10 weeks", ageMonthsMin: 2.5, vaccines: ["Pentavalent dose 2", "OPV dose 2", "PCV dose 2"] },
  { ageLabel: "14 weeks", ageMonthsMin: 3.5, vaccines: ["Pentavalent dose 3", "OPV dose 3", "PCV dose 3", "IPV"] },
  { ageLabel: "9 months", ageMonthsMin: 9, vaccines: ["Measles-rubella (MR) dose 1"] },
  { ageLabel: "12 months", ageMonthsMin: 12, vaccines: ["MR dose 2 (catch-up window)", "PCV booster (if indicated)"] },
  { ageLabel: "15 months", ageMonthsMin: 15, vaccines: ["Hepatitis A (if in local program)", "Varicella (optional)"] },
  { ageLabel: "4–5 years", ageMonthsMin: 48, vaccines: ["DTaP booster", "OPV booster", "MMR catch-up"] },
];

export type NipVaccineEntry = { key: string; label: string; ageMonthsDue: number };

export type NipStatus = "given" | "due" | "overdue" | "upcoming" | "catch-up";

export type NipStatusRow = NipVaccineEntry & { status: NipStatus };

const KEY_RULES: { key: string; tokens: string[] }[] = [
  { key: "bcg", tokens: ["bcg"] },
  { key: "hepatitis b birth", tokens: ["hepatitis b", "hep b", "hepb"] },
  { key: "pentavalent", tokens: ["pentavalent", "dpt-hib", "dpt hib"] },
  { key: "opv", tokens: ["opv", "oral polio"] },
  { key: "pcv", tokens: ["pcv", "pneumococcal"] },
  { key: "ipv", tokens: ["ipv", "inactivated polio"] },
  { key: "measles", tokens: ["measles"] },
  { key: "mr", tokens: ["mr", "measles-rubella", "measles rubella"] },
  { key: "mmr", tokens: ["mmr"] },
];

function normalizeVaxName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bdose\s*\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferKey(label: string): string {
  const n = normalizeVaxName(label);
  for (const rule of KEY_RULES) {
    if (rule.tokens.some((t) => n.includes(t))) return rule.key;
  }
  return n.slice(0, 24) || "vaccine";
}

export const NIP_VACCINES: NipVaccineEntry[] = NIP_SCHEDULE.flatMap((row) =>
  row.vaccines.map((label) => ({
    key: inferKey(label),
    label,
    ageMonthsDue: row.ageMonthsMin,
  })),
);

function isGivenForKey(key: string, givenNames: string[]): boolean {
  const rule = KEY_RULES.find((r) => r.key === key);
  const tokens = rule?.tokens ?? [key];
  return givenNames.some((raw) => {
    const n = normalizeVaxName(raw);
    return tokens.some((t) => n.includes(t));
  });
}

/** Schedule rows due at or before the child's age (rough PH NIP/EPI checklist). */
export function nipDueForAgeMonths(ageMonths: number): typeof NIP_SCHEDULE {
  if (ageMonths < 0) return [];
  return NIP_SCHEDULE.filter((row) => row.ageMonthsMin <= ageMonths);
}

export function computeNipStatus(ageMonths: number, givenNames: string[]): NipStatusRow[] {
  if (ageMonths < 0) return [];
  const sorted = [...NIP_VACCINES].sort((a, b) => a.ageMonthsDue - b.ageMonthsDue || a.label.localeCompare(b.label));

  return sorted.map((entry, idx) => {
    if (isGivenForKey(entry.key, givenNames)) {
      return { ...entry, status: "given" as const };
    }
    const nextMilestone = sorted.slice(idx + 1).find((v) => v.ageMonthsDue > entry.ageMonthsDue)?.ageMonthsDue ?? null;

    if (ageMonths < entry.ageMonthsDue) {
      return { ...entry, status: "upcoming" as const };
    }
    if (ageMonths < entry.ageMonthsDue + 1) {
      return { ...entry, status: "due" as const };
    }
    if (nextMilestone != null && ageMonths >= nextMilestone) {
      return { ...entry, status: "catch-up" as const };
    }
    return { ...entry, status: "overdue" as const };
  });
}

export function inferDoseNumberFromLabel(label: string): string {
  const m = label.match(/\bdose\s*(\d+)/i);
  return m ? m[1] : "1";
}
//JJQR - END
