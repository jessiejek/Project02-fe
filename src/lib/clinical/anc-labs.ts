//JJQR - AI (Oct 31, 2026)
import type { LabTestRow } from "@/lib/data/lookups";

export type AncPresetId = "baseline" | "24-28" | "36";

export type AncPreset = {
  id: AncPresetId;
  label: string;
  /** Display names when catalog has no match (case preserved for print). */
  requiredNames: string[];
  /** Case-insensitive substring patterns — first catalog hit per pattern. */
  catalogPatterns: string[];
  /** Optional patterns — added when catalog match exists. */
  optionalCatalogPatterns?: string[];
};

export const ANC_PRESETS: AncPreset[] = [
  {
    id: "baseline",
    label: "ANC Baseline / 1st visit",
    requiredNames: ["CBC", "Blood type", "Urinalysis", "HBsAg", "HIV", "Syphilis", "FBS"],
    catalogPatterns: ["CBC", "BLOOD TYPE", "URINALYSIS", "HBsAg", "HIV", "SYPHILIS", "FBS"],
    optionalCatalogPatterns: ["OGTT"],
  },
  {
    id: "24-28",
    label: "ANC 24–28 weeks",
    requiredNames: ["75g OGTT", "CBC"],
    catalogPatterns: ["75g OGTT", "OGTT", "CBC"],
  },
  {
    id: "36",
    label: "ANC 36 weeks",
    requiredNames: ["CBC", "Urinalysis", "GBS"],
    catalogPatterns: ["CBC", "URINALYSIS", "GBS"],
  },
];

function catalogMatchByPattern(catalog: LabTestRow[], pattern: string): LabTestRow | null {
  const p = pattern.toLowerCase();
  return catalog.find((t) => t.name.toLowerCase().includes(p)) ?? null;
}

export function matchLabTests(
  catalog: LabTestRow[],
  presetId: AncPresetId,
): { catalogMatches: LabTestRow[]; missingNames: string[] } {
  const preset = ANC_PRESETS.find((x) => x.id === presetId);
  if (!preset) return { catalogMatches: [], missingNames: [] };

  const catalogMatches: LabTestRow[] = [];
  const seenIds = new Set<string>();
  const matchedPatterns = new Set<string>();

  const tryPattern = (pattern: string, requiredIndex: number | null) => {
    const hit = catalogMatchByPattern(catalog, pattern);
    if (hit && !seenIds.has(hit.lab_test_id)) {
      catalogMatches.push(hit);
      seenIds.add(hit.lab_test_id);
      matchedPatterns.add(pattern.toLowerCase());
      return true;
    }
    return false;
  };

  preset.catalogPatterns.forEach((pattern, i) => {
    if (preset.id === "24-28" && i === 0) {
      if (tryPattern("75g OGTT", i)) return;
      tryPattern("OGTT", i);
      return;
    }
    tryPattern(pattern, i);
  });

  preset.optionalCatalogPatterns?.forEach((pattern) => tryPattern(pattern, null));

  const missingNames: string[] = [];
  preset.requiredNames.forEach((name, i) => {
    let patternsForName: string[];
    if (preset.id === "24-28" && i === 0) {
      patternsForName = ["75g ogtt", "ogtt"];
    } else if (preset.id === "24-28" && i === 1) {
      patternsForName = ["cbc"];
    } else {
      patternsForName = [preset.catalogPatterns[i]?.toLowerCase() ?? name.toLowerCase()];
    }
    const covered = patternsForName.some(
      (p) => matchedPatterns.has(p) || catalogMatches.some((t) => t.name.toLowerCase().includes(p)),
    );
    if (!covered) missingNames.push(name);
  });

  return { catalogMatches, missingNames };
}
//JJQR - END
