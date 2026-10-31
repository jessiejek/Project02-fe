//JJQR - AI (Oct 31, 2026)
type Sex = "male" | "female";
export type GrowthMeasure = "weight" | "height" | "hc" | "bmi";
type Measure = GrowthMeasure;

type PercentileCurve = { ageMonths: number; p3: number; p50: number; p97: number };

export type GrowthCurvePoint = {
  ageMonths: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

function withMidCentiles(c: PercentileCurve): GrowthCurvePoint {
  return {
    ageMonths: c.ageMonths,
    p3: c.p3,
    p15: (c.p3 + c.p50) / 2,
    p50: c.p50,
    p85: (c.p50 + c.p97) / 2,
    p97: c.p97,
  };
}

/** Rough WHO-ish weight (kg) centiles at selected ages 0–60 mo — interpolate between points. */
const WEIGHT_BOYS: PercentileCurve[] = [
  { ageMonths: 0, p3: 2.5, p50: 3.3, p97: 4.4 },
  { ageMonths: 6, p3: 6.4, p50: 7.9, p97: 9.8 },
  { ageMonths: 12, p3: 8.0, p50: 9.6, p97: 11.8 },
  { ageMonths: 24, p3: 9.7, p50: 12.2, p97: 15.3 },
  { ageMonths: 36, p3: 11.3, p50: 14.3, p97: 18.0 },
  { ageMonths: 48, p3: 12.7, p50: 16.3, p97: 21.0 },
  { ageMonths: 60, p3: 14.0, p50: 18.3, p97: 24.0 },
];

const WEIGHT_GIRLS: PercentileCurve[] = [
  { ageMonths: 0, p3: 2.4, p50: 3.2, p97: 4.2 },
  { ageMonths: 6, p3: 5.8, p50: 7.3, p97: 9.1 },
  { ageMonths: 12, p3: 7.4, p50: 8.9, p97: 11.0 },
  { ageMonths: 24, p3: 9.0, p50: 11.5, p97: 14.8 },
  { ageMonths: 36, p3: 10.5, p50: 13.9, p97: 18.1 },
  { ageMonths: 48, p3: 12.0, p50: 16.1, p97: 21.5 },
  { ageMonths: 60, p3: 13.2, p50: 18.1, p97: 24.8 },
];

const HEIGHT_BOYS: PercentileCurve[] = [
  { ageMonths: 0, p3: 46.3, p50: 49.9, p97: 53.7 },
  { ageMonths: 12, p3: 71.0, p50: 75.7, p97: 80.5 },
  { ageMonths: 24, p3: 81.7, p50: 87.1, p97: 92.5 },
  { ageMonths: 36, p3: 88.7, p50: 96.1, p97: 103.3 },
  { ageMonths: 48, p3: 94.9, p50: 103.3, p97: 111.7 },
  { ageMonths: 60, p3: 100.0, p50: 110.0, p97: 119.2 },
];

const HEIGHT_GIRLS: PercentileCurve[] = [
  { ageMonths: 0, p3: 45.6, p50: 49.1, p97: 52.9 },
  { ageMonths: 12, p3: 69.2, p50: 74.0, p97: 79.2 },
  { ageMonths: 24, p3: 80.0, p50: 85.7, p97: 91.4 },
  { ageMonths: 36, p3: 87.4, p50: 95.1, p97: 102.7 },
  { ageMonths: 48, p3: 93.9, p50: 102.7, p97: 111.3 },
  { ageMonths: 60, p3: 99.0, p50: 109.4, p97: 118.9 },
];

const HC_BOYS: PercentileCurve[] = [
  { ageMonths: 0, p3: 32.1, p50: 34.5, p97: 36.9 },
  { ageMonths: 6, p3: 40.0, p50: 43.3, p97: 46.6 },
  { ageMonths: 12, p3: 43.0, p50: 46.1, p97: 49.2 },
  { ageMonths: 24, p3: 45.5, p50: 48.3, p97: 51.1 },
];

const HC_GIRLS: PercentileCurve[] = [
  { ageMonths: 0, p3: 31.5, p50: 33.9, p97: 36.2 },
  { ageMonths: 6, p3: 39.0, p50: 42.2, p97: 45.4 },
  { ageMonths: 12, p3: 41.9, p50: 45.0, p97: 48.0 },
  { ageMonths: 24, p3: 44.4, p50: 47.2, p97: 50.0 },
];

function curveTable(sex: Sex, measure: Measure): PercentileCurve[] | null {
  if (measure === "weight") return sex === "male" ? WEIGHT_BOYS : WEIGHT_GIRLS;
  if (measure === "height") return sex === "male" ? HEIGHT_BOYS : HEIGHT_GIRLS;
  if (measure === "hc") return sex === "male" ? HC_BOYS : HC_GIRLS;
  if (measure === "bmi") return null;
  return null;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateCurve(table: PercentileCurve[], ageMonths: number): PercentileCurve | null {
  if (ageMonths < 0 || ageMonths > 60) return null;
  if (table.length === 0) return null;
  if (ageMonths <= table[0].ageMonths) return table[0];
  const last = table[table.length - 1];
  if (ageMonths >= last.ageMonths) return last;
  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i];
    const hi = table[i + 1];
    if (ageMonths >= lo.ageMonths && ageMonths <= hi.ageMonths) {
      const t = (ageMonths - lo.ageMonths) / (hi.ageMonths - lo.ageMonths);
      return {
        ageMonths,
        p3: lerp(lo.p3, hi.p3, t),
        p50: lerp(lo.p50, hi.p50, t),
        p97: lerp(lo.p97, hi.p97, t),
      };
    }
  }
  return null;
}

function valueToPercentile(value: number, curve: PercentileCurve): number {
  const { p3, p50, p97 } = curve;
  if (value <= p3) return Math.max(1, Math.round(3 * (value / p3)));
  if (value >= p97) return Math.min(99, Math.round(97 + (2 * (value - p97)) / p97));
  if (value <= p50) {
    const t = (value - p3) / (p50 - p3);
    return Math.round(3 + t * 47);
  }
  const t = (value - p50) / (p97 - p50);
  return Math.round(50 + t * 47);
}

export function estimatePercentile(
  sex: Sex | "Male" | "Female" | string,
  ageMonths: number,
  measure: Measure,
  value: number,
): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const s: Sex = String(sex).toLowerCase().startsWith("f") ? "female" : "male";
  const table = curveTable(s, measure);
  if (!table) return null;
  const curve = interpolateCurve(table, ageMonths);
  if (!curve) return null;
  return valueToPercentile(value, curve);
}

/** Monthly WHO-ish centile curves from birth through maxAge (months). */
export function getCurvePoints(sex: Sex | "Male" | "Female" | string, measure: GrowthMeasure, maxAge = 60): GrowthCurvePoint[] {
  const s: Sex = String(sex).toLowerCase().startsWith("f") ? "female" : "male";
  const table = curveTable(s, measure);
  if (!table) return [];
  const cap = Math.min(60, Math.max(0, maxAge));
  const out: GrowthCurvePoint[] = [];
  for (let mo = 0; mo <= cap; mo++) {
    const c = interpolateCurve(table, mo);
    if (c) out.push(withMidCentiles(c));
  }
  return out;
}
//JJQR - END
