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
//JJQR - END
