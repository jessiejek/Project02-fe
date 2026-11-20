//JJQR - AI (Nov 20, 2026) E1 — values the doctor should not retype on a medical certificate
export function joinNonBlank(parts: Array<string | null | undefined>, sep = ", "): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);
}

export function patientAddressFromProfile(address?: string | null, city?: string | null): string {
  return joinNonBlank([address, city]);
}

export function examinedAtFromClinic(clinicName?: string | null, clinicAddress?: string | null): string {
  return joinNonBlank([clinicName, clinicAddress]);
}

export function diagnosisTextFromConsult(descriptions: string[], assessment?: string | null): string {
  const fromDx = descriptions.map((d) => d.trim()).filter(Boolean).join("; ");
  return fromDx || (assessment ?? "").trim();
}

//JJQR - AI (Nov 20, 2026) E2 — template DiagnosisText is ignored when diagnoses or Assessment already exist
export function shouldApplyTemplateDiagnosis(descriptions: string[], assessment?: string | null): boolean {
  return diagnosisTextFromConsult(descriptions, assessment) === "";
}

//JJQR - AI (Nov 20, 2026) E3 — print sentence is "residing at <address>"; strip a duplicated prefix and dangling commas
export function cleanMedCertAddress(addr: string | null | undefined): string {
  let s = (addr ?? "").trim();
  s = s.replace(/^(residing at\s+)+/i, "").trim();
  s = s.replace(/[,\s]+$/g, "").trim();
  s = s.replace(/,\s*,+/g, ", ");
  return s;
}

//JJQR - AI (Nov 20, 2026) E4 — fee add-on follows a filled/issued certificate, not a checkbox
export function medCertFeeAddOn(opts: {
  certExists: boolean;
  recommendations: string;
  purposeException: string;
  comeBackOn: string;
}): boolean {
  if (opts.certExists) return true;
  return [opts.recommendations, opts.purposeException, opts.comeBackOn].some((s) => s.trim() !== "");
}
//JJQR - END
