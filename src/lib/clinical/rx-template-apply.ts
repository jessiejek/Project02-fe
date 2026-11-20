//JJQR - AI (Nov 19, 2026) - new file: pure helpers for applying an Rx template to the prescription list (what gets added, what is skipped and why, what the doctor is told)
export interface RxApplyItem {
  id: string;
  rxId: string;
  genericName: string;
  dosage: string;
  quantity: string;
  instruction: string;
  isControlledSubstance?: boolean;
  mealRelation?: "Before" | "After" | null;
  timing?: string | null;
  //JJQR - AI (Nov 20, 2026)
  asNeeded?: boolean | null;
  //JJQR - END
  durationKind?: "Maintain" | "Days" | "Weeks" | null;
  durationValue?: number | null;
  indication?: string | null;
  route?: string | null;
}

export type RxSkipReason = "duplicate" | "allergy" | "safety";
export interface RxSkipped {
  genericName: string;
  reason: RxSkipReason;
  message: string;
}
export interface RxSafetyHit {
  level: "warn" | "block";
  message: string;
}
export interface RxApplyPlan {
  toAdd: RxApplyItem[];
  skipped: RxSkipped[];
  warnings: string[];
}

/**
 * Decide which template medicines go onto the prescription. Keeps every field of each line
 * (route defaults to PO like before); skips duplicates (against the list and within the batch),
 * allergy conflicts and hard drug-safety blocks, and records why so the doctor is told.
 */
export function planTemplateApply(
  templateItems: RxApplyItem[],
  existingGenericNames: string[],
  opts: {
    allergyConflict: (genericName: string) => string | null;
    safety: (genericName: string, currentNames: string[]) => RxSafetyHit[];
    newId: () => string;
  },
): RxApplyPlan {
  const names = [...existingGenericNames];
  const plan: RxApplyPlan = { toAdd: [], skipped: [], warnings: [] };
  for (const item of templateItems) {
    const key = item.genericName.trim().toLowerCase();
    const allergen = opts.allergyConflict(item.genericName);
    if (allergen) {
      plan.skipped.push({ genericName: item.genericName, reason: "allergy", message: `Allergy conflict: ${item.genericName} ↔ ${allergen}` });
      continue;
    }
    const alerts = opts.safety(item.genericName, names);
    const block = alerts.find((a) => a.level === "block");
    if (block) {
      plan.skipped.push({ genericName: item.genericName, reason: "safety", message: block.message });
      continue;
    }
    if (names.some((n) => n.trim().toLowerCase() === key)) {
      plan.skipped.push({ genericName: item.genericName, reason: "duplicate", message: `${item.genericName} is already on the list` });
      continue;
    }
    const warn = alerts.find((a) => a.level === "warn");
    if (warn) plan.warnings.push(warn.message);
    plan.toAdd.push({ ...item, id: opts.newId(), route: item.route ?? "PO" });
    names.push(item.genericName);
  }
  return plan;
}

/** The one message the doctor sees after tapping a template. */
export function describeTemplateApply(templateTitle: string, templateItemCount: number, plan: RxApplyPlan): { variant: "success" | "warning" | "error"; message: string } {
  const n = plan.toAdd.length;
  if (templateItemCount === 0) return { variant: "warning", message: `"${templateTitle}" has no medicines yet. Edit the template to add some.` };
  const med = (c: number) => `${c} medicine${c === 1 ? "" : "s"}`;
  if (n > 0) {
    const skippedBits = plan.skipped.length ? `; skipped ${plan.skipped.length} (${plan.skipped.map((s) => `${s.genericName}: ${s.reason === "duplicate" ? "already on the list" : s.message}`).join("; ")})` : "";
    return { variant: plan.skipped.length ? "warning" : "success", message: `Added ${med(n)} from ${templateTitle}${skippedBits}` };
  }
  if (plan.skipped.every((s) => s.reason === "duplicate")) return { variant: "warning", message: `Nothing added: all ${med(plan.skipped.length)} from ${templateTitle} are already on the list.` };
  return { variant: "error", message: `Nothing added from ${templateTitle}. ${plan.skipped.map((s) => s.message).join("; ")}` };
}
//JJQR - END
