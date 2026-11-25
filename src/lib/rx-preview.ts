//JJQR - AI (2026-11-25) - owner: the Sig line on screen showed the strength ("Sig. 500mg 1 tab…"); show it exactly like the printed form (name + strength, then Sig. route + instructions)
// Plain module (no React) so node:test can check it (rx-preview.test.mjs).
import { sigFreeText } from "./print-forms-html.ts";
import { rxDisplayName } from "./rx-sig-parse.ts";

export interface RxPreviewInput {
  genericName: string;
  dosage?: string | null;
  route?: string | null;
  instruction?: string | null;
}

/** The medicine name as printed: "Paracetamol 500mg" (the strength is not repeated when the name already has it). */
export function rxPreviewName(i: RxPreviewInput): string {
  return rxDisplayName(i.genericName ?? "", i.dosage ?? "");
}

/** The Sig text as printed: route + instructions, e.g. "PO 1 tab every 6 hours" (never the strength). */
export function rxPreviewSig(i: RxPreviewInput): string {
  return sigFreeText({ route: i.route ?? null, instruction: i.instruction ?? null });
}
//JJQR - END
