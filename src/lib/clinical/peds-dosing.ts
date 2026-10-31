//JJQR - AI (Oct 31, 2026)
export function mgPerKgDose(mgPerKg: number, weightKg: number, maxMg?: number): { mg: number; capped: boolean } {
  if (!Number.isFinite(mgPerKg) || !Number.isFinite(weightKg) || weightKg <= 0) {
    return { mg: 0, capped: false };
  }
  let mg = mgPerKg * weightKg;
  let capped = false;
  if (maxMg != null && Number.isFinite(maxMg) && mg > maxMg) {
    mg = maxMg;
    capped = true;
  }
  return { mg: Math.round(mg * 10) / 10, capped };
}

export function mlFromConcentration(mgNeeded: number, mgPerMl: number): number {
  if (!Number.isFinite(mgNeeded) || !Number.isFinite(mgPerMl) || mgPerMl <= 0) return 0;
  return Math.round((mgNeeded / mgPerMl) * 10) / 10;
}
//JJQR - END
