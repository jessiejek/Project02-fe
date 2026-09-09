/**
 * Per-resource backend switch for the Supabase → .NET migration.
 *
 * Each `src/lib/data/<resource>.ts` module calls `resolveMode("<resource>")`
 * and routes to either the Supabase path (today) or `src/lib/api/client.ts`.
 * A migration phase "flips" a resource by moving it into `DOTNET_RESOURCES`
 * (or setting the global default), verifying parity, then deleting the
 * Supabase branch in a later cleanup.
 *
 * Global default: NEXT_PUBLIC_API_MODE = "supabase" | "dotnet"  (default "supabase")
 * Per-resource override always wins over the global default.
 */

export type ApiMode = "supabase" | "dotnet";

export type DataResource =
  | "profiles"
  | "patients"
  | "staff_accounts"
  | "doctors"
  | "doctor_schedules"
  | "doctor_services"
  | "doctor_blocked_dates"
  | "doctor_day_statuses"
  | "services"
  | "medicines"
  | "vital_field_templates"
  | "icd10_codes"
  | "bookings"
  | "booking_services"
  | "payments"
  | "reviews"
  | "consultations"
  | "consultation_diagnoses"
  | "medical_certificates"
  | "patient_vital_readings"
  | "follow_ups"
  | "prescription_groups"
  | "prescription_line_items"
  | "prescription_templates"
  | "prescription_template_items"
  | "doctor_favorite_medicines"
  | "soap_templates"
  | "soap_phrases"
  | "lab_orders"
  | "patient_vaccinations"
  | "patient_documents"
  | "patient_lab_results"
  | "audit_logs"
  | "announcements"
  | "clinic_settings"
  | "clinic_operating_hours"
  | "clinic_accepted_payment_methods"
  | "reports";

// Default is now "dotnet" — every resource with a data module is migrated.
// Set NEXT_PUBLIC_API_MODE=supabase only to fall back for debugging.
const GLOBAL_DEFAULT: ApiMode =
  process.env.NEXT_PUBLIC_API_MODE === "supabase" ? "supabase" : "dotnet";

/**
 * Resources already migrated and parity-verified. Add entries here as phases land.
 * Phase 0: empty — everything is still Supabase.
 */
const DOTNET_RESOURCES: ReadonlySet<DataResource> = new Set<DataResource>([
  // Phase 2 — reads via src/lib/data/*.ts, parity-verified
  "doctors",
  "patients",
  "staff_accounts",
  "doctor_services",
  // Phase 3 — clinical lookup tables
  "medicines",
  "vital_field_templates",
  "icd10_codes",
  // Phase 4b/4c — booking reads + status transitions via src/lib/data/bookings.ts
  "bookings",
  // Phase 4d — confirm / waive / refund via src/lib/data/payments.ts
  "payments",
  // Phase 5 — clinical resources via src/lib/data/clinical.ts
  "consultations",
  "consultation_diagnoses",
  "medical_certificates",
  "patient_vital_readings",
  "follow_ups",
  "prescription_groups",
  "prescription_line_items",
  "prescription_templates",
  "prescription_template_items",
  "doctor_favorite_medicines",
  "soap_templates",
  "soap_phrases",
  "audit_logs",
  // Phase 6 — patient files, vaccinations, reviews via src/lib/data/patientFiles.ts
  "patient_documents",
  "patient_lab_results",
  "patient_vaccinations",
  "reviews",
  // Phase 7 — admin settings / announcements / audit / reports via src/lib/data/admin.ts
  "clinic_settings",
  "clinic_operating_hours",
  "clinic_accepted_payment_methods",
  "announcements",
  "reports",
]);

export function resolveMode(resource: DataResource): ApiMode {
  if (GLOBAL_DEFAULT === "dotnet") return "dotnet";
  return DOTNET_RESOURCES.has(resource) ? "dotnet" : "supabase";
}

export function isDotnet(resource: DataResource): boolean {
  return resolveMode(resource) === "dotnet";
}
