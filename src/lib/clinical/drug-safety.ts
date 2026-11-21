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

//JJQR - AI (Nov 22, 2026) - an allergy to a drug CLASS must block its members ("Penicillin" allergy vs "Amoxicillin": the names never contain each other). Same list as the desktop app.
const ALLERGY_CLASSES: { cls: string; members: string[] }[] = [
  { cls: "penicillin", members: ["penicillin", "amoxicillin", "ampicillin", "cloxacillin", "dicloxacillin", "flucloxacillin", "oxacillin", "piperacillin", "amoxiclav", "co-amoxiclav", "clavulan"] },
  { cls: "cephalosporin", members: ["cef", "ceph"] },
  { cls: "sulfa", members: ["sulfa", "sulfonamide", "cotrimoxazole", "co-trimoxazole", "trimethoprim"] },
  { cls: "nsaid", members: ["ibuprofen", "mefenamic", "diclofenac", "naproxen", "ketorolac", "celecoxib", "etoricoxib", "aspirin", "indomethacin", "meloxicam"] },
  { cls: "macrolide", members: ["azithromycin", "clarithromycin", "erythromycin"] },
  { cls: "quinolone", members: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin", "floxacin"] },
];

/** The recorded allergen (trimmed) that conflicts with this medicine: same name, or the medicine belongs to the allergen's drug class. */
export function allergyConflictFor(genericName: string, patientAllergies: string[] | null | undefined): string | null {
  const g = norm(genericName);
  if (!g || !patientAllergies?.length) return null;
  for (const raw of patientAllergies) {
    const al = norm(raw);
    if (!al) continue;
    if (g.includes(al) || al.includes(g)) return raw.trim();
    for (const { cls, members } of ALLERGY_CLASSES) {
      const allergyInClass = al.includes(cls) || members.some((m) => al.includes(m));
      if (allergyInClass && members.some((m) => g.includes(m))) return raw.trim();
    }
  }
  return null;
}

//JJQR - AI (Nov 22, 2026) - child cautions (template doses are adult doses)
const CHILD_CAUTIONS: { match: string; maxAge: number; note: string }[] = [
  { match: "loperamide", maxAge: 12, note: "Loperamide is not for children under 12." },
  { match: "aspirin", maxAge: 16, note: "Aspirin is avoided under 16 (Reye syndrome risk)." },
  { match: "codeine", maxAge: 12, note: "Codeine is not for children under 12." },
  { match: "tramadol", maxAge: 12, note: "Tramadol is not for children under 12." },
  { match: "doxycycline", maxAge: 8, note: "Tetracyclines are avoided under 8 (teeth and bone)." },
  { match: "tetracycline", maxAge: 8, note: "Tetracyclines are avoided under 8 (teeth and bone)." },
  { match: "floxacin", maxAge: 18, note: "Fluoroquinolones are avoided under 18 unless specialist advice." },
];

export function checkDrugSafety(
  genericNames: string[],
  opts?: { pregnant?: boolean; trimester?: number; ageYears?: number | null },
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

  if (opts?.ageYears != null && opts.ageYears < 18 && names.length > 0) {
    for (const c of CHILD_CAUTIONS) {
      if (opts.ageYears < c.maxAge && names.some((n) => n.includes(c.match))) push("warn", `Child patient (${opts.ageYears} y): ${c.note}`);
    }
    push("warn", `Child patient (${opts.ageYears} y): confirm each dose by weight. Template doses are adult doses.`);
  }

  return out;
}
//JJQR - END
