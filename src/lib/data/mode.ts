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

const GLOBAL_DEFAULT: ApiMode =
  process.env.NEXT_PUBLIC_API_MODE === "dotnet" ? "dotnet" : "supabase";

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
]);

export function resolveMode(resource: DataResource): ApiMode {
  if (GLOBAL_DEFAULT === "dotnet") return "dotnet";
  return DOTNET_RESOURCES.has(resource) ? "dotnet" : "supabase";
}

export function isDotnet(resource: DataResource): boolean {
  return resolveMode(resource) === "dotnet";
}
