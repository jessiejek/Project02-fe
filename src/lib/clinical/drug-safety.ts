//JJQR - AI (Oct 31, 2026)
export const DUPLICATE_THERAPY_GROUPS: string[][] = [
  ["losartan", "telmisartan", "valsartan", "candesartan", "olmesartan"],
  ["amlodipine", "nifedipine", "felodipine"],
  ["simvastatin", "atorvastatin", "rosuvastatin", "pravastatin"],
  ["ibuprofen", "mefenamic", "naproxen", "diclofenac"],
  ["metformin", "glipizide", "glibenclamide"],
];

export const INTERACTION_PAIRS: { a: string; b: string; note: string }[] = [
  { a: "warfarin", b: "ibuprofen", note: "Warfarin + NSAID: increased bleeding risk — monitor INR, consider gastroprotection." },
  { a: "warfarin", b: "naproxen", note: "Warfarin + NSAID: increased bleeding risk — monitor INR." },
  { a: "warfarin", b: "mefenamic", note: "Warfarin + NSAID: increased bleeding risk — monitor INR." },
  { a: "lisinopril", b: "potassium", note: "ACE inhibitor + potassium supplement: hyperkalemia risk." },
  { a: "enalapril", b: "potassium", note: "ACE inhibitor + potassium supplement: hyperkalemia risk." },
  { a: "losartan", b: "potassium", note: "ARB + potassium supplement: hyperkalemia risk." },
  { a: "metformin", b: "contrast", note: "Metformin + iodinated contrast: consider holding metformin per local renal protocol." },
  { a: "simvastatin", b: "clarithromycin", note: "Statin + macrolide: myopathy/rhabdo risk — prefer azithromycin or pause statin briefly." },
  { a: "atorvastatin", b: "erythromycin", note: "Statin + macrolide: myopathy risk — use caution or alternative antibiotic." },
  { a: "lithium", b: "ibuprofen", note: "Lithium + NSAID: raised lithium levels — monitor." },
  { a: "methotrexate", b: "trimethoprim", note: "Methotrexate + trimethoprim: bone marrow suppression risk." },
];

export const PREGNANCY_UNSAFE: { match: string; note: string; trimester?: "all" | "3" }[] = [
  { match: "losartan", note: "ACEi/ARB contraindicated in pregnancy — switch antihypertensive." },
  { match: "telmisartan", note: "ACEi/ARB contraindicated in pregnancy." },
  { match: "enalapril", note: "ACE inhibitor contraindicated in pregnancy." },
  { match: "ramipril", note: "ACE inhibitor contraindicated in pregnancy." },
  { match: "lisinopril", note: "ACE inhibitor contraindicated in pregnancy." },
  { match: "simvastatin", note: "Statin contraindicated in pregnancy." },
  { match: "atorvastatin", note: "Statin contraindicated in pregnancy." },
  { match: "warfarin", note: "Warfarin teratogenic — avoid unless specialist plan." },
  { match: "doxycycline", note: "Tetracycline class — avoid in pregnancy." },
  { match: "tetracycline", note: "Tetracycline class — avoid in pregnancy." },
  { match: "isotretinoin", note: "Isotretinoin: absolute teratogen — do not prescribe." },
  { match: "methotrexate", note: "Methotrexate teratogenic — contraindicated." },
  { match: "misoprostol", note: "Misoprostol abortifacient — contraindicated." },
  { match: "valproate", note: "Valproate: neural tube defect risk — avoid if possible." },
  { match: "ibuprofen", note: "NSAID — avoid especially 3rd trimester (ductus closure).", trimester: "3" },
  { match: "mefenamic", note: "NSAID — avoid especially 3rd trimester.", trimester: "3" },
  { match: "naproxen", note: "NSAID — avoid especially 3rd trimester.", trimester: "3" },
];

const PREGNANCY_BLOCKS = new Set(["isotretinoin", "methotrexate", "warfarin", "misoprostol"]);

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function drugMatches(name: string, token: string): boolean {
  const n = norm(name);
  const t = norm(token);
  if (!n || !t) return false;
  return n.includes(t) || t.includes(n);
}

function namesMatchList(names: string[], token: string): boolean {
  return names.some((n) => drugMatches(n, token));
}

export function checkDrugSafety(
  genericNames: string[],
  opts?: { pregnant?: boolean; trimester?: number },
): { level: "warn" | "block"; message: string }[] {
  const names = genericNames.map(norm).filter(Boolean);
  const out: { level: "warn" | "block"; message: string }[] = [];
  const seen = new Set<string>();

  function push(level: "warn" | "block", message: string) {
    const key = `${level}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ level, message });
  }

  for (const group of DUPLICATE_THERAPY_GROUPS) {
    const hits = names.filter((n) => group.some((g) => drugMatches(n, g)));
    if (hits.length >= 2) {
      push("warn", `Duplicate therapy (${group.slice(0, 3).join("/")}…): ${[...new Set(hits)].join(", ")}`);
    }
  }

  for (const pair of INTERACTION_PAIRS) {
    if (namesMatchList(names, pair.a) && namesMatchList(names, pair.b)) {
      push("warn", pair.note);
    }
  }

  if (opts?.pregnant) {
    for (const n of names) {
      if ([...PREGNANCY_BLOCKS].some((b) => drugMatches(n, b))) {
        push("block", `Pregnancy: ${n} is contraindicated (teratogen/high risk).`);
      }
    }
    for (const entry of PREGNANCY_UNSAFE) {
      if (entry.trimester === "3" && opts.trimester != null && opts.trimester < 3) continue;
      const hit = names.find((n) => drugMatches(n, entry.match));
      if (!hit) continue;
      if ([...PREGNANCY_BLOCKS].some((b) => drugMatches(hit, b))) continue;
      push("warn", `Pregnancy: ${entry.note}`);
    }
  }

  return out;
}
//JJQR - END
