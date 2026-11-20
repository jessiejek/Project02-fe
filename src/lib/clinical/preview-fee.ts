//JJQR - AI (Nov 20, 2026) F3 — clinic fee total + breakdown; total matches the old consultation2 previewFee
import { formatPeso } from "@/lib/format";

export type ClinicFeeSchedule = {
  consultation: number;
  followUp: number;
  seniorPwd: number;
  medCert: number;
  discountPct: number;
};

export type ClinicFeePart = {
  label: string;
  amount: number;
  op: "+" | "−";
};

export type ClinicFeePreview = {
  total: number;
  parts: ClinicFeePart[];
  summary: string;
};

/** Signed sum of breakdown parts; must equal `total`. */
export function clinicFeePartsSum(parts: readonly ClinicFeePart[]): number {
  return parts.reduce((sum, part) => sum + (part.op === "−" ? -part.amount : part.amount), 0);
}

/**
 * Same math as the former inline previewFee:
 *   subtotal = discount ? seniorPwd : (FollowUp ? followUp : consultation)
 *   total    = subtotal + (medCert ? medCert : 0)
 * Breakdown parts are derived from those same inputs so total == sum.
 */
export function computeClinicFee(
  schedule: ClinicFeeSchedule,
  visitType: "New" | "FollowUp",
  discountCategory: "Senior" | "PWD" | "",
  medCertRequested: boolean,
): ClinicFeePreview {
  const visitLabel = visitType === "FollowUp" ? "Follow-up" : "Consultation";
  const visitAmount = visitType === "FollowUp" ? schedule.followUp : schedule.consultation;
  const medAmount = medCertRequested ? schedule.medCert : 0;
  const hasDiscount = Boolean(discountCategory);
  const subtotal = hasDiscount ? schedule.seniorPwd : visitAmount;
  const total = subtotal + medAmount;
  const parts: ClinicFeePart[] = [{ label: visitLabel, amount: visitAmount, op: "+" }];
  if (medCertRequested) parts.push({ label: "Medical certificate", amount: medAmount, op: "+" });
  if (hasDiscount) {
    const discLabel = discountCategory === "PWD" ? "PWD discount" : "Senior discount";
    parts.push({ label: discLabel, amount: visitAmount - schedule.seniorPwd, op: "−" });
  }
  const breakdown = parts
    .map((part, i) => {
      const piece = `${part.label} ${formatPeso(part.amount)}`;
      if (i === 0) return piece;
      return part.op === "−" ? ` − ${piece}` : ` + ${piece}`;
    })
    .join("");
  return { total, parts, summary: `Total: ${formatPeso(total)} (${breakdown})` };
}

//JJQR - AI (Nov 20, 2026) F5 — Charge is the editor default when nothing is stored; view still shows stored null as Decide at desk
export type PfStoredDecision = {
  type: "Charge" | "Waive";
  amount?: number | null;
  waiveReason?: string | null;
};

export function pfEditorDecisionFromStored(
  stored: PfStoredDecision | null | undefined,
): "charge" | "waive" {
  return stored?.type === "Waive" ? "waive" : "charge";
}

export function pfViewDecisionFromStored(
  stored: PfStoredDecision | null | undefined,
): "charge" | "waive" | null {
  if (stored?.type === "Charge") return "charge";
  if (stored?.type === "Waive") return "waive";
  return null;
}

export function pfEditorAmountFromStored(stored: PfStoredDecision | null | undefined): string {
  return stored?.type === "Charge" && stored.amount != null ? String(stored.amount) : "";
}

export function shouldPrefillChargeAmount(
  decision: "charge" | "waive" | null,
  amount: string,
  storedType?: "Charge" | "Waive" | null,
): boolean {
  return decision === "charge" && amount.trim() === "" && storedType !== "Charge";
}
//JJQR - END
