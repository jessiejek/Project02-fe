//JJQR - AI (2026-11-26) - GAV-10: the doctor's "Edit details" dialog (consultation header + patient chart). Every field PUT /api/patients/{id}
// copies onto the patient (PatientsController.Update), the same limits as the API (Rules.Patient), age worked out from the birthday.
// Plain module (no React, no "@/" imports) so node:test can check it (patient-edit.test.mjs).
// NOT in the dialog because the PUT ignores them: email, senior ID, PWD ID, guardian, pregnancy/OB and renal-lab fields.

export interface PatientEditForm {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  sex: "Male" | "Female";
  civilStatus: string;
  contactNumber: string;
  address: string;
  city: string;
  zipCode: string;
  bloodType: string;
  philhealthNumber: string;
  hmoProvider: string;
  hmoCardNumber: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  emergencyContactRelationship: string;
}

/** The patient row fields the form reads (snake_case, as GET /api/patients/{id} returns them). */
export interface PatientEditSource {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  sex: string;
  civil_status?: string | null;
  contact_number?: string | null;
  address?: string | null;
  city?: string | null;
  zip_code?: string | null;
  blood_type?: string | null;
  philhealth_number?: string | null;
  hmo_provider?: string | null;
  hmo_card_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  emergency_contact_relationship?: string | null;
}

export const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed", "Separated", "Annulled"] as const;
export const BLOOD_TYPE_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export function formFromPatient(p: PatientEditSource): PatientEditForm {
  return {
    firstName: p.first_name ?? "",
    middleName: p.middle_name ?? "",
    lastName: p.last_name ?? "",
    dateOfBirth: p.date_of_birth ?? "",
    sex: p.sex === "Female" ? "Female" : "Male",
    civilStatus: p.civil_status ?? "",
    contactNumber: p.contact_number ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    zipCode: p.zip_code ?? "",
    bloodType: p.blood_type ?? "",
    philhealthNumber: p.philhealth_number ?? "",
    hmoProvider: p.hmo_provider ?? "",
    hmoCardNumber: p.hmo_card_number ?? "",
    emergencyContactName: p.emergency_contact_name ?? "",
    emergencyContactNumber: p.emergency_contact_number ?? "",
    emergencyContactRelationship: p.emergency_contact_relationship ?? "",
  };
}

/** Same rule as toTitleCase in lib/data/patients (admin dialog / registration): "juan dela cruz" -> "Juan Dela Cruz". */
export function titleCase(s: string): string {
  return s.trim().replace(/[^\s'-]+/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

const opt = (v: string): string | null => (v.trim() ? v.trim() : null);

/** The patch sent with updatePatient (fetch-merge-put). Names are title-cased like the admin dialog. */
export function patchFromForm(f: PatientEditForm) {
  return {
    first_name: titleCase(f.firstName),
    middle_name: f.middleName.trim() ? titleCase(f.middleName) : null,
    last_name: titleCase(f.lastName),
    date_of_birth: f.dateOfBirth,
    sex: f.sex,
    civil_status: opt(f.civilStatus),
    contact_number: opt(f.contactNumber),
    address: opt(f.address),
    city: opt(f.city),
    zip_code: opt(f.zipCode),
    blood_type: opt(f.bloodType),
    philhealth_number: opt(f.philhealthNumber),
    hmo_provider: opt(f.hmoProvider),
    hmo_card_number: opt(f.hmoCardNumber),
    emergency_contact_name: opt(f.emergencyContactName),
    emergency_contact_number: opt(f.emergencyContactNumber),
    emergency_contact_relationship: opt(f.emergencyContactRelationship),
  };
}

/** Whole years on `today` (both YYYY-MM-DD, Manila); null when the birthday is blank or in the future. */
export function ageOn(dateOfBirth: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || dateOfBirth > today) return null;
  const [ty, tm, td] = today.split("-").map(Number);
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

const PHONE = /^[0-9+()\-.\s]{7,20}$/;
function phoneOk(v: string): boolean {
  const t = v.trim();
  return !t || (PHONE.test(t) && t.replace(/\D/g, "").length >= 7);
}

/** First problem the API would refuse (Rules.Patient limits), or null. Field key is for focus/highlight. */
export function patientEditProblem(f: PatientEditForm, today: string): { field: keyof PatientEditForm; message: string } | null {
  if (!f.firstName.trim()) return { field: "firstName", message: "First name is required." };
  if (!f.lastName.trim()) return { field: "lastName", message: "Last name is required." };
  if (!f.dateOfBirth) return { field: "dateOfBirth", message: "Birthday is required." };
  if (f.dateOfBirth > today) return { field: "dateOfBirth", message: "Birthday cannot be in the future." };
  if (f.dateOfBirth < "1900-01-01") return { field: "dateOfBirth", message: "Birthday is too far in the past." };
  if (!phoneOk(f.contactNumber)) return { field: "contactNumber", message: "Contact number must be a phone number (digits, spaces, + - ( ) only)." };
  if (!phoneOk(f.emergencyContactNumber)) return { field: "emergencyContactNumber", message: "Emergency contact number must be a phone number (digits, spaces, + - ( ) only)." };
  const limits: [keyof PatientEditForm, number, string][] = [
    ["firstName", 100, "First name"], ["middleName", 100, "Middle name"], ["lastName", 100, "Last name"],
    ["civilStatus", 30, "Civil status"], ["address", 300, "Address"], ["city", 100, "City"], ["zipCode", 20, "Zip code"],
    ["bloodType", 10, "Blood type"], ["philhealthNumber", 30, "PhilHealth number"], ["hmoProvider", 100, "HMO provider"],
    ["hmoCardNumber", 50, "HMO card number"], ["emergencyContactName", 150, "Emergency contact name"],
    ["emergencyContactRelationship", 100, "Emergency contact relationship"],
  ];
  for (const [k, max, label] of limits) {
    if (String(f[k]).trim().length > max) return { field: k, message: `${label} is too long (max ${max} characters).` };
  }
  return null;
}

/** "First Last" as the doctor screens show it (middle name stays out, same as before). */
export function displayName(f: { firstName: string; lastName: string }): string {
  return [titleCase(f.firstName), titleCase(f.lastName)].filter(Boolean).join(" ");
}
//JJQR - END
