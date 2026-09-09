// Shapes mirror the as-built field names documented in Patient.md/Staff.md/
// Doctor.md/admin.md — not invented. Per React-Conversion-Guide.md §1, this
// pass renders from local mock data only; these types are what real API
// responses will eventually match.

export type BookingStatus =
  | "Pending"
  | "ProofSubmitted"
  | "Confirmed"
  | "CheckedIn"
  | "InProgress"
  | "OnHold"
  | "Cancelled"
  | "Completed"
  | "Expired"
  | "NoShow"
  | "Rescheduled";

export type PaymentStatus = "Unpaid" | "Paid" | "Waived" | "Refunded";
export type PaymentMode = "Online" | "PayAtClinic";

export interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  sex: "Male" | "Female";
  civilStatus: string;
  address: string;
  city: string;
  zipCode: string;
  contactNumber: string;
  email: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  emergencyContactRelationship?: string;
  bloodType?: string;
  philHealthNumber?: string;
  hmoProvider?: string;
  hmoCardNumber?: string;
  isEmailVerified: boolean;
  consentedAt?: string;
  consentVersion: number;
}

export interface DoctorService {
  id: string;
  name: string;
  // Patient.md §4: "services offered (category, price, duration)" — was
  // missing, found during the flow-completeness audit.
  category: "Consultation" | "Procedure" | "Laboratory" | "Diagnostic";
  price: number;
  durationMinutes: number;
}

// admin.md §6 doctors-list column; Doctor.md §7's weekly schedule editor.
// Replaces the old flat `workingDays: string[]` — that had no room for
// per-day start/end times, even though schema.sql's doctor_schedules table
// already supported them. Always 7 entries, Sun→Sat.
export interface DoctorScheduleDay {
  day: string; // "Sun".."Sat"
  isActive: boolean;
  startTime: string; // "08:00"
  endTime: string; // "17:00"
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  consultationFee: number;
  bio: string;
  rating: number;
  reviewCount: number;
  dayStatus: "Available" | "RunningLate" | "UnavailableToday";
  runningLateMinutes?: number;
  services: DoctorService[];
  schedule: DoctorScheduleDay[];
  // admin.md §6's Doctor Form documents these as 3 separate fields
  // ("PRC/PTR/S2 numbers") — DoctorForm.tsx had them merged into one input,
  // found during the database-schema verification pass.
  licenseNumber?: string;
  ptrNumber?: string;
  s2Number?: string;
  // Matches staff_accounts.email/doctors.slot_duration_minutes in schema.sql
  // — both already existed in the schema but DoctorForm.tsx's fields for
  // them were never added to this type, found during the decorative-input
  // sweep. status matches DoctorForm's own Active/Inactive/OnLeave dropdown.
  email?: string;
  status?: "Active" | "Inactive" | "OnLeave";
  slotDurationMinutes?: number;
}

export interface Booking {
  id: string;
  // Patient.md §5's documented Booking fields include patientId — this was
  // missing from the initial mock type, which is why staff/admin booking
  // tables/detail pages could never show which patient a booking belongs to
  // (found during the doctor/staff/admin flow completeness audit).
  patientId: string;
  patientName: string;
  patientCode: string;
  doctorId: string;
  doctorName: string;
  serviceNames: string[];
  appointmentDate: string;
  slotStartTime: string;
  slotEndTime: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  queueNumber?: string;
  totalFee: number;
  amountDue: number;
  isProfessionalFeeWaived?: boolean;
  professionalFeeWaivedReason?: string;
  // Patient.md §5: present once an Online payment's proof has been submitted.
  proofType?: "ReferenceNumber" | "Screenshot";
  proofValue?: string;
  createdAt: string;
  // Captured by admin/bookings/[id]'s Reject/Waive/Refund modals — this page
  // treats Booking as the single source of truth for payment status (it
  // never touches a separate Payment record), so these live here rather than
  // on a Payment row, found during the decorative-input sweep.
  cancellationReason?: string;
  waivedReason?: string;
  refundReason?: string;
  refundAmount?: number;
}

// Gaps.md §1.2 flags a real conflict here: Doctor.md documented this as
// Primary/Secondary only; Patient.md documented Primary/Secondary/
// Differential/Comorbidity. Phase 0's own instructions were to resolve this
// by grepping the real .NET backend — that backend doesn't exist in this
// greenfield rebuild, so there's nothing to grep. Decision for this build:
// adopt the superset (Patient.md's version) since it can always represent
// the narrower Doctor.md set, never the other way around. Recorded here
// rather than silently picking one, per the doc set's own rule against
// resolving Gaps.md items by guessing.
export interface Diagnosis {
  code: string;
  description: string;
  type: "Primary" | "Secondary" | "Differential" | "Comorbidity";
}

// Rebuilt per clinic-vitals-fe.md's reference architecture: the 7 standard
// vitals are not hardcoded form fields — they're "design templates" fetched
// from the server (isDefault === true), always rendered on the form. A
// doctor can also pick non-default templates via the "Others" modal, which
// appends an extra input card (isDefault === false) — that's how custom
// vitals like "Fundal Height" work, without a schema change.
export interface VitalFieldTemplate {
  id: string;
  description: string; // e.g. "TEMPERATURE", "Fundal Height"
  formKey: string; // snake_case form key, e.g. "temperature"
  unit: string; // "" for custom vitals
  icon: string;
  isDefault: boolean;
}

// One saved value per (booking, template). A booking with no rows yet shows
// all default templates as empty; saved rows pre-fill them.
export interface PatientVitalReading {
  id: string;
  bookingId: string;
  patientId: string;
  templateId: string;
  value: string;
  recordedAt: string;
}

export interface ConsultationLabOrder {
  testName: string;
  reason?: string;
  specimenType?: string;
  notes?: string;
}

export interface ConsultationVaccinationEntry {
  vaccineName: string;
  doseNumber?: string;
  route?: string;
  site?: string;
  lotNumber?: string;
  expiry?: string;
  manufacturer?: string;
}

export interface ConsultationFeeDecision {
  type: "Charge" | "Waive";
  amount?: number;
  paymentMode?: PaymentMode;
  notes?: string;
  waiveReason?: string;
}

export type SoapField = "chiefComplaint" | "subjective" | "objective" | "assessment" | "plan";

// Speed tooling for the SOAP section — added after a UX review flagged
// retyping "normal" findings by hand as the single biggest source of
// documentation friction. Mirrors the exact Favorites/Templates split
// PrescriptionLineItem already established: a "phrase" is a single-field
// quick-insert shortcut (like DoctorFavoriteMedicine), a "template" is a
// full multi-field bundle (like PrescriptionTemplate, including the same
// isSystemTemplate concept for clinic-wide defaults).
export interface SoapPhrase {
  id: string;
  doctorId: string;
  field: SoapField;
  label: string; // e.g. "Normal Cardiac Exam" — shown in the picker
  text: string; // the actual snippet inserted into the field
}

// One row covers all 5 SOAP fields — a genuine 1:1 attribute set with no
// repetition (exactly like Consultation's own chiefComplaint/subjective/
// objective/assessment/plan flat columns), not a repeating group, so this
// stays a single flat record rather than a header+items pair.
export interface SoapTemplate {
  id: string;
  doctorId: string;
  title: string;
  isSystemTemplate?: boolean; // clinic-wide default (e.g. "Annual Physical — Normal"), hides edit/delete
  chiefComplaint?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

// Doctor.md §4: "Same ConsultationSummaryComponent" for view mode — the read
// display must show every section recorded during the consultation, not
// just SOAP + diagnoses (found during the "standard consultation page" audit).
export interface Consultation {
  id: string;
  bookingId: string;
  // Patient.md §10 documents patientId on Consultation — was missing, which
  // is why doctor/staff/admin patient-detail pages could never filter
  // records to just the patient being viewed (found during the flow audit).
  patientId: string;
  doctorName: string;
  appointmentDate: string;
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnoses: Diagnosis[];
  // Vitals moved out to PatientVitalReading (keyed by bookingId), per
  // clinic-vitals-fe.md's template-driven architecture — no longer a flat
  // embedded object here. Prescriptions moved out the same way, to
  // PrescriptionGroup (keyed by bookingId), per clinic-prescriptions-fe.md.
  labOrders?: ConsultationLabOrder[];
  vaccinationsAdministered?: ConsultationVaccinationEntry[];
  feeDecision?: ConsultationFeeDecision;
  followUpDate?: string;
  followUpReason?: string;
  followUpInstructions?: string;
  followUpReminder?: boolean;
}

// Rebuilt per clinic-prescriptions-fe.md: replaces the three overlapping
// shapes this app had (Prescription/PrescriptionItem for the standalone
// patient-facing list, ConsultationPrescriptionItem for the in-consultation
// draft) with one canonical model. A prescription is a PrescriptionGroup (one
// per visit), made of PrescriptionLineItems — no more separate strength/
// dosageForm/dose/frequency/duration/route fields; those collapse into a
// single free-text genericName + dosage + instruction, matching the
// reference's simpler model (e.g. "PARACETAMOL 500MG TAB" / dosage "2" /
// instruction "After Meal as needed").
export interface PrescriptionLineItem {
  id: string;
  rxId: string; // Medicine catalog id this line was added from.
  genericName: string;
  dosage: string;
  // Free text, not a strict count — doctors write things like "50pcs" or
  // "1 box", not just a bare number.
  quantity: string;
  instruction: string;
  isControlledSubstance?: boolean;
  // §16.8 Form 1 — the clinic's real Rx pad columns.
  mealRelation?: "Before" | "After" | null;
  timing?: string | null; // comma-joined subset of Breakfast/Lunch/Dinner/Bedtime
  durationKind?: "Maintain" | "Days" | "Weeks" | null;
  durationValue?: number | null;
  indication?: string | null;
}

export interface PrescriptionGroup {
  id: string;
  patientId: string;
  doctorId: string;
  bookingId: string;
  createdAt: string;
  items: PrescriptionLineItem[];
}

// Search/autocomplete catalog for the "New Prescription" tab.
export interface Medicine {
  id: string;
  genericName: string;
}

// Single-medicine reuse shortcut — distinct from PrescriptionTemplate, which
// is a full reusable multi-medicine set (see clinic-prescriptions-fe.md §3
// "Add to Favorites vs Add to Template").
export interface DoctorFavoriteMedicine {
  id: string;
  doctorId: string;
  item: PrescriptionLineItem;
}

export interface PrescriptionTemplate {
  id: string;
  doctorId: string;
  title: string;
  isSystemTemplate?: boolean; // e.g. "Medical Certificate" — hides edit/delete.
  items: PrescriptionLineItem[];
}

export interface PatientVaccination {
  id: string;
  patientId: string;
  vaccineName: string;
  doseNumber?: number;
  administeredDate?: string;
  status: "Administered" | "Scheduled" | "Overdue";
  source: "AdministeredInClinic" | "PatientReported" | "ExternalRecord";
}

export interface PatientDocument {
  id: string;
  patientId: string;
  bookingId: string;
  fileName: string;
  title?: string;
  description?: string;
  uploadedAt: string;
}

export interface PatientLabResult {
  id: string;
  patientId: string;
  bookingId: string;
  fileName: string;
  resultTitle?: string;
  status: string;
  uploadedAt: string;
}

// Staff.md data model additions

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  paymentMethod?: "Cash" | "GCash" | "Maya" | "BankTransfer";
  referenceNumber?: string;
  orNumber?: string;
  status: PaymentStatus;
  waivedReason?: string;
}

export interface PatientSummary {
  id: string;
  patientCode: string;
  fullName: string;
  sex: "Male" | "Female";
  dateOfBirth: string;
  contactNumber: string;
  email: string;
  accountStatus: "LinkedAccount" | "NoAccount" | "AccountUnknown";
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  postedDate: string;
  postedBy: string;
  isActive: boolean;
}

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  role: "Staff" | "Doctor" | "Admin";
  // "OnLeave" added to match the staff_status enum (schema.sql) and
  // DoctorForm.tsx's own status dropdown — not yet surfaced in this app's
  // staff-management UI, but kept in sync with the enum regardless.
  status: "Active" | "Inactive" | "Invited" | "OnLeave";
}

// admin.md data model additions

export interface ManagedService {
  id: string;
  name: string;
  category: "Consultation" | "Procedure" | "Laboratory" | "Diagnostic";
  description?: string;
  price: number;
  isActive: boolean;
  doctorNames: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  entityType: "Booking" | "Patient" | "Doctor" | "Payment" | "Settings" | "Consultation" | "Staff";
  entityId: string;
  action: string;
  performedBy: string;
  details?: string;
}

export interface ClinicSettings {
  clinicName: string;
  address: string;
  contactNumber?: string;
  email?: string;
  description?: string;
  defaultPaymentMode: PaymentMode;
  acceptedPaymentMethods: string[];
  refundPolicy?: string;
  consentVersion: number;
  primaryColor?: string;
  secondaryColor?: string;
  // All 4 already existed as columns on clinic_settings (schema.sql) — the
  // admin/settings Privacy/Branding tabs have real UI for them, but this
  // type never caught up, found during the decorative-input sweep.
  privacyPolicyText?: string;
  logoUrl?: string;
  faviconUrl?: string;
  websiteUrl?: string;
  // §16.6 — flat clinic-wide fee schedule. Doctor picks which line applies at
  // consultation (visit_type / discount category); the backend recomputes the
  // booking total on consultation save.
  feeConsultation: number;
  feeFollowUp: number;
  feeSeniorPwd: number;
  feeMedCert: number;
  discountPct: number;
}

// Matches clinic_operating_hours (schema.sql) exactly — admin/settings' Hours
// tab previously had no backing data at all, not even hardcoded per-day mock
// values, found during the decorative-input sweep.
export interface OperatingHours {
  day: string; // "Sun".."Sat"
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}
