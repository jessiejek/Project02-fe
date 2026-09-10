# Frontend ↔ Backend 1:1 Contract (Supabase → .NET)

> **Purpose:** Convert this clinic app’s Supabase backend to .NET **without breaking the frontend**.
>
> Source of truth: live TypeScript types in `src/data/supabase-types.ts` + every `.from()` / Auth / Storage call under `src/`.
>
> **Shared wire models for .NET:** `dotnet-contract/WireModels.cs`  
> (C# DTOs with `[JsonPropertyName("snake_case")]` matching what the FE already reads.)

---

## 0. Shared models rule (read this first)

### What “same models FE + BE” means for this project

| Layer | File | Naming | Shared with .NET? |
|-------|------|--------|-------------------|
| **Wire JSON** (API request/response) | `supabase-types.ts` Row shapes + this doc + `dotnet-contract/WireModels.cs` | `snake_case` | **YES — this is the contract** |
| **UI domain models** | `src/data/types.ts`, `SessionInfo` | `camelCase` | **NO** — FE-only after mapping |

The frontend already does:

```
Supabase JSON (patient_id)  →  map in page  →  UI model (patientId)
```

So for a **backend-only swap**:

1. .NET must emit/accept the **left side** (`patient_id`, …).
2. Do **not** make .NET return `types.ts` shapes (`patientId`, …) or the FE breaks.
3. Copy/paste from `dotnet-contract/WireModels.cs` into your API project; keep JSON names unchanged.

### Wire format is **snake_case** — keep it 1:1

```json
{
  "patient_id": "…",
  "first_name": "Juan",
  "last_name": "Dela Cruz",
  "date_of_birth": "1990-01-01"
}
```

| Wire (JSON from API) | UI / Session after map |
|----------------------|------------------------|
| `patient_id` | `patientId` / `session.patientId` |
| `staff_id` | `staffId` / `session.staffId` |
| `booking_id` | `bookingId` |
| `full_name` | `displayName` (derived) |

**If .NET returns PascalCase (`PatientId`, `FirstName`) by default, the frontend breaks.**

### .NET setup (required)

```csharp
// Program.cs — either policy OR [JsonPropertyName] on every property (WireModels.cs uses attributes)
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = null; // honor [JsonPropertyName]
        o.JsonSerializerOptions.DictionaryKeyPolicy = null;
    });
```

**Do NOT:**

- Rename `patient_id` → `patientId` on the wire
- Use `src/data/types.ts` as the .NET API model
- Rename enum strings (`"PayAtClinic"` ≠ `"pay_at_clinic"`)
- Drop nested join shapes the frontend expects (see §6)

### Two naming layers (do not confuse them)

1. **Wire / DB / PostgREST** = `snake_case` ← **shared with .NET**
2. **React UI state** = `camelCase` ← stays in Next.js until a separate FE refactor

---

## 1. Environment variables (exact names)

> **Supabase teardown complete (2026-09-10).** The app reads only `NEXT_PUBLIC_API_URL`.
> The `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` vars are gone from app
> source — they linger in `.env.local` only for the `scripts/parity/*` +
> `scripts/dev/import-from-supabase.mjs` Node scripts that still read the live
> Supabase project. History below.

| Variable | Client-visible? | Used by |
|----------|-----------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | `src/lib/api/client.ts` (`API_BASE_URL`); default `http://localhost:5000` |
| ~~`NEXT_PUBLIC_SUPABASE_URL`~~ | — | removed; parity/import scripts only |
| ~~`NEXT_PUBLIC_SUPABASE_ANON_KEY`~~ | — | removed |
| ~~`SUPABASE_SERVICE_ROLE_KEY`~~ | — | removed from app; parity/import scripts only |

For .NET: map these to your config, but **JSON field names in responses stay snake_case** regardless of how you name C# config keys.

---

## 2. Identity & roles (exact strings)

### `profiles.role` / `user_role` enum (exact)

`"Patient"` | `"Staff"` | `"Doctor"` | `"Admin"`

### URL segment map (frontend)

| `profiles.role` | Dashboard path |
|-----------------|----------------|
| `Patient` | `/patient/dashboard` |
| `Staff` | `/staff/dashboard` |
| `Doctor` | `/doctor/dashboard` |
| `Admin` | `/admin/dashboard` |

Defined in `src/middleware.ts` and `src/app/login/page.tsx` as `ROLE_TO_SEGMENT`.

### Identity chain (FKs — do not invent new PK names)

```
auth.users.id
  └─ profiles.id          (role)
  ├─ Patient  → patients.user_id   → patients.patient_id
  └─ Staff/Doctor/Admin → staff_accounts.user_id → staff_accounts.staff_id
       └─ Doctor → doctors.doctor_id = staff_accounts.staff_id (1:1)
```

### `SessionInfo` (UI only — camelCase)

Built in `src/components/providers/SessionProvider.tsx` from wire fields:

| Session field | Source wire field(s) |
|---------------|----------------------|
| `userId` | Auth `user.id` |
| `role` | `profiles.role` |
| `displayName` | Patient: `` `${first_name} ${last_name}` ``; Staff+: `staff_accounts.full_name` |
| `avatarUrl` | `staff_accounts.avatar_url` |
| `staffId` | `staff_accounts.staff_id` |
| `patientId` | `patients.patient_id` |

---

## 3. Enums — exact string values (1:1)

Copy these **character-for-character**. Source: `src/data/supabase-types.ts` → `Enums` / `Constants`.

| Enum | Values |
|------|--------|
| `user_role` | `Patient`, `Staff`, `Doctor`, `Admin` |
| `staff_role` | `Staff`, `Doctor`, `Admin` |
| `staff_status` | `Active`, `Inactive`, `Invited`, `OnLeave` |
| `sex_type` | `Male`, `Female` |
| `doctor_day_status` | `Available`, `RunningLate`, `UnavailableToday` |
| `service_category` | `Consultation`, `Procedure`, `Laboratory`, `Diagnostic` |
| `booking_status` | `Pending`, `ProofSubmitted`, `Confirmed`, `CheckedIn`, `InProgress`, `OnHold`, `Cancelled`, `Completed`, `Expired`, `NoShow`, `Rescheduled` |
| `payment_mode` | `Online`, `PayAtClinic` |
| `payment_status` | `Unpaid`, `Paid`, `Waived`, `Refunded` |
| `payment_method` | `Cash`, `GCash`, `Maya`, `BankTransfer` |
| `proof_type` | `ReferenceNumber`, `Screenshot` |
| `consultation_status` | `Draft`, `Completed`, `Amended` |
| `diagnosis_type` | `Primary`, `Secondary`, `Differential`, `Comorbidity` |
| `soap_field` | `ChiefComplaint`, `Subjective`, `Objective`, `Assessment`, `Plan` |
| `lab_order_status` | `Requested`, `Completed` |
| `vaccination_status` | `Administered`, `Scheduled`, `Overdue` |
| `vaccination_source` | `AdministeredInClinic`, `PatientReported`, `ExternalRecord` |
| `audit_entity_type` | `Booking`, `Patient`, `Doctor`, `Payment`, `Settings`, `Consultation`, `Staff` |
| `follow_up_status` | `Pending`, `Completed` |

---

## 4. Tables — columns 1:1 (wire names)

Every column name below is what JSON must use. Types are TypeScript/PostgREST shapes.

### `profiles`

| Column | Type |
|--------|------|
| `id` | uuid (PK = auth user id) |
| `role` | `user_role` |
| `created_at` | timestamptz |

### `patients`

| Column | Type |
|--------|------|
| `patient_id` | uuid PK |
| `user_id` | uuid \| null |
| `patient_code` | text |
| `first_name` | text |
| `middle_name` | text \| null |
| `last_name` | text |
| `date_of_birth` | date |
| `sex` | `sex_type` |
| `civil_status` | text \| null |
| `address` | text \| null |
| `city` | text \| null |
| `zip_code` | text \| null |
| `contact_number` | text \| null |
| `email` | text |
| `emergency_contact_name` | text \| null |
| `emergency_contact_number` | text \| null |
| `emergency_contact_relationship` | text \| null |
| `blood_type` | text \| null |
| `philhealth_number` | text \| null |
| `hmo_provider` | text \| null |
| `hmo_card_number` | text \| null |
| `is_guest` | boolean |
| `is_email_verified` | boolean |
| `consented_at` | timestamptz \| null |
| `consent_version` | integer |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `staff_accounts`

| Column | Type |
|--------|------|
| `staff_id` | uuid PK |
| `user_id` | uuid |
| `full_name` | text |
| `email` | text |
| `contact_number` | text \| null |
| `role` | `staff_role` |
| `status` | `staff_status` |
| `avatar_url` | text \| null |
| `invited_at` | timestamptz |
| `revoked_at` | timestamptz \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `doctors`

| Column | Type |
|--------|------|
| `doctor_id` | uuid PK (= `staff_accounts.staff_id`) |
| `specialization` | text |
| `consultation_fee` | number |
| `bio` | text \| null |
| `license_number` | text \| null |
| `ptr_number` | text \| null |
| `s2_number` | text \| null |
| `slot_duration_minutes` | integer |
| `slot_capacity` | integer |
| `daily_patient_limit` | integer \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `doctor_schedules`

| Column | Type |
|--------|------|
| `id` | uuid |
| `doctor_id` | uuid |
| `day_of_week` | smallint (0–6) |
| `is_active` | boolean |
| `start_time` | time |
| `end_time` | time |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Unique conflict key used by frontend: `doctor_id,day_of_week`

### `doctor_blocked_dates`

| Column | Type |
|--------|------|
| `id` | uuid |
| `doctor_id` | uuid |
| `blocked_date` | date |
| `reason` | text \| null |
| `created_at` | timestamptz |

### `doctor_day_statuses`

| Column | Type |
|--------|------|
| `id` | uuid |
| `doctor_id` | uuid |
| `status_date` | date |
| `status` | `doctor_day_status` |
| `running_late_minutes` | integer \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Conflict: `doctor_id,status_date`

### `services`

| Column | Type |
|--------|------|
| `service_id` | uuid |
| `name` | text |
| `category` | `service_category` |
| `description` | text \| null |
| `price` | number |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `doctor_services`

| Column | Type |
|--------|------|
| `doctor_id` | uuid |
| `service_id` | uuid |
| `duration_minutes` | integer |
| `created_at` | timestamptz |

Composite PK: (`doctor_id`, `service_id`)

### `bookings`

| Column | Type |
|--------|------|
| `booking_id` | uuid |
| `patient_id` | uuid |
| `doctor_id` | uuid |
| `appointment_date` | date |
| `slot_start_time` | time |
| `slot_end_time` | time |
| `status` | `booking_status` |
| `payment_mode` | `payment_mode` |
| `queue_number` | text \| null |
| `consultation_fee_snapshot` | number |
| `total_fee` | number |
| `amount_due` | number |
| `is_walk_in` | boolean |
| `proof_type` | `proof_type` \| null |
| `proof_value` | text \| null |
| `proof_submitted_at` | timestamptz \| null |
| `cancelled_by_user_id` | uuid \| null |
| `cancellation_reason` | text \| null |
| `notes` | text \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `booking_services`

| Column | Type |
|--------|------|
| `booking_id` | uuid |
| `service_id` | uuid |
| `price_at_booking` | number |

### `payments`

| Column | Type |
|--------|------|
| `payment_id` | uuid |
| `booking_id` | uuid (1:1) |
| `amount` | number |
| `status` | `payment_status` |
| `payment_method` | `payment_method` \| null |
| `reference_number` | text \| null |
| `or_number` | text \| null |
| `amount_received` | number \| null |
| `confirm_notes` | text \| null |
| `confirmed_by_user_id` | uuid \| null |
| `confirmed_at` | timestamptz \| null |
| `waived_by_user_id` | uuid \| null |
| `waived_reason` | text \| null |
| `waived_at` | timestamptz \| null |
| `refunded_by_user_id` | uuid \| null |
| `refund_amount` | number \| null |
| `refund_reason` | text \| null |
| `refunded_at` | timestamptz \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `reviews`

| Column | Type |
|--------|------|
| `review_id` | uuid |
| `booking_id` | uuid |
| `doctor_id` | uuid |
| `patient_id` | uuid |
| `rating` | smallint (1–5) |
| `comment` | text \| null |
| `created_at` | timestamptz |

### `consultations`

| Column | Type |
|--------|------|
| `consultation_id` | uuid |
| `booking_id` | uuid (unique) |
| `patient_id` | uuid |
| `doctor_id` | uuid |
| `status` | `consultation_status` |
| `chief_complaint` | text \| null |
| `subjective` | text \| null |
| `objective` | text \| null |
| `assessment` | text \| null |
| `plan` | text \| null |
| `doctor_notes` | text \| null |
| `completed_by_user_id` | uuid \| null |
| `completed_at` | timestamptz \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Upsert conflict used by UI: `booking_id`

### `consultation_diagnoses`

| Column | Type |
|--------|------|
| `id` | uuid |
| `consultation_id` | uuid |
| `icd10_code` | text \| null |
| `custom_description` | text \| null |
| `type` | `diagnosis_type` |
| `created_at` | timestamptz |

### `vital_field_templates`

| Column | Type |
|--------|------|
| `template_id` | uuid |
| `description` | text |
| `form_key` | text |
| `unit` | text |
| `icon` | text |
| `is_default` | boolean |
| `created_at` | timestamptz |

### `patient_vital_readings`

| Column | Type |
|--------|------|
| `id` | uuid |
| `booking_id` | uuid |
| `patient_id` | uuid |
| `template_id` | uuid |
| `value` | text |
| `recorded_at` | date |
| `recorded_by_user_id` | uuid \| null — **PROPOSED, not in live DB yet.** See §16. |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Conflict: `booking_id,template_id`

### `follow_ups`

| Column | Type |
|--------|------|
| `id` | uuid |
| `consultation_id` | uuid (unique) |
| `patient_id` | uuid |
| `doctor_id` | uuid |
| `follow_up_date` | date |
| `reason` | text \| null |
| `instructions` | text \| null |
| `reminder_enabled` | boolean |
| `status` | `follow_up_status` |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Conflict: `consultation_id`  
Note: view `v_pending_follow_ups` exposes `follow_up_id` (= this `id`).

### `icd10_codes`

| Column | Type |
|--------|------|
| `code` | text PK |
| `description` | text |

(DDL exists; frontend does **not** query this table today.)

### `soap_phrases`

| Column | Type |
|--------|------|
| `id` | uuid |
| `doctor_id` | uuid |
| `field` | `soap_field` |
| `label` | text |
| `body` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `soap_templates`

| Column | Type |
|--------|------|
| `id` | uuid |
| `doctor_id` | uuid |
| `title` | text |
| `is_system_template` | boolean |
| `chief_complaint` | text \| null |
| `subjective` | text \| null |
| `objective` | text \| null |
| `assessment` | text \| null |
| `plan` | text \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `medicines`

| Column | Type |
|--------|------|
| `medicine_id` | uuid |
| `generic_name` | text |
| `created_at` | timestamptz |

### `prescription_groups`

| Column | Type |
|--------|------|
| `group_id` | uuid |
| `patient_id` | uuid |
| `doctor_id` | uuid |
| `booking_id` | uuid |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `prescription_line_items`

| Column | Type |
|--------|------|
| `id` | uuid |
| `group_id` | uuid |
| `medicine_id` | uuid |
| `generic_name` | text |
| `dosage` | text |
| `quantity` | text |
| `instruction` | text \| null |
| `is_controlled_substance` | boolean |
| `created_at` | timestamptz |

### `doctor_favorite_medicines`

| Column | Type |
|--------|------|
| `id` | uuid |
| `doctor_id` | uuid |
| `medicine_id` | uuid |
| `generic_name` | text |
| `dosage` | text |
| `quantity` | text |
| `instruction` | text \| null |
| `created_at` | timestamptz |

### `prescription_templates`

| Column | Type |
|--------|------|
| `template_id` | uuid |
| `doctor_id` | uuid |
| `title` | text |
| `is_system_template` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `prescription_template_items`

| Column | Type |
|--------|------|
| `id` | uuid |
| `template_id` | uuid |
| `medicine_id` | uuid |
| `generic_name` | text |
| `dosage` | text |
| `quantity` | text |
| `instruction` | text \| null |
| `is_controlled_substance` | boolean |
| `created_at` | timestamptz |

### `lab_orders`

| Column | Type |
|--------|------|
| `lab_order_id` | uuid |
| `consultation_id` | uuid |
| `patient_id` | uuid |
| `doctor_id` | uuid |
| `test_name` | text |
| `test_code` | text \| null |
| `reason` | text \| null |
| `clinical_indication` | text \| null |
| `specimen_type` | text \| null |
| `notes` | text \| null |
| `status` | `lab_order_status` |
| `requested_at` | timestamptz |
| `result_attachment_url` | text \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

(DDL exists; consultation UI currently keeps labs **local-only** — no `.from("lab_orders")` yet.)

### `patient_vaccinations`

| Column | Type |
|--------|------|
| `id` | uuid |
| `patient_id` | uuid |
| `consultation_id` | uuid \| null |
| `vaccine_name` | text |
| `manufacturer` | text \| null |
| `dose_number` | smallint \| null |
| `route` | text \| null |
| `site` | text \| null |
| `lot_number` | text \| null |
| `expiry_date` | date \| null |
| `administered_date` | date \| null |
| `administered_by` | uuid \| null |
| `next_dose_date` | date \| null |
| `status` | `vaccination_status` |
| `source` | `vaccination_source` |
| `notes` | text \| null |
| `reaction_notes` | text \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

(Reads exist; consultation write path is still local-only.)

### `patient_documents`

| Column | Type |
|--------|------|
| `id` | uuid |
| `patient_id` | uuid |
| `booking_id` | uuid |
| `consultation_id` | uuid \| null |
| `file_name` | text |
| `file_size` | bigint \| null |
| `file_content_type` | text \| null |
| `title` | text \| null |
| `description` | text \| null |
| `file_url` | text |
| `uploaded_by_user_id` | uuid \| null |
| `uploaded_at` | timestamptz |

### `patient_lab_results`

| Column | Type |
|--------|------|
| `id` | uuid |
| `patient_id` | uuid |
| `booking_id` | uuid |
| `consultation_id` | uuid \| null |
| `lab_order_id` | uuid \| null |
| `file_name` | text |
| `file_content_type` | text \| null |
| `result_title` | text \| null |
| `result_text` | text \| null |
| `status` | text (default `"Completed"` — plain text, not enum) |
| `file_url` | text |
| `uploaded_at` | timestamptz |

### `audit_logs`

| Column | Type |
|--------|------|
| `id` | uuid |
| `entity_type` | `audit_entity_type` |
| `entity_id` | uuid |
| `action` | text |
| `performed_by_user_id` | uuid \| null |
| `details` | text \| null |
| `performed_at` | timestamptz |

### `announcements`

| Column | Type |
|--------|------|
| `id` | uuid |
| `title` | text |
| `body` | text |
| `is_active` | boolean |
| `posted_by_user_id` | uuid \| null |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `clinic_settings` (singleton `id = 1`)

| Column | Type |
|--------|------|
| `id` | smallint (= 1) |
| `clinic_name` | text |
| `address` | text |
| `contact_number` | text \| null |
| `email` | text \| null |
| `description` | text \| null |
| `default_payment_mode` | `payment_mode` |
| `refund_policy` | text \| null |
| `consent_version` | integer |
| `primary_color` | text \| null |
| `secondary_color` | text \| null |
| `logo_url` | text \| null |
| `favicon_url` | text \| null |
| `website_url` | text \| null |
| `privacy_policy_text` | text \| null |
| `updated_by_user_id` | uuid \| null |
| `updated_at` | timestamptz |

### `clinic_operating_hours`

| Column | Type |
|--------|------|
| `day_of_week` | smallint PK (0–6) |
| `is_closed` | boolean |
| `open_time` | time \| null |
| `close_time` | time \| null |

### `clinic_accepted_payment_methods`

| Column | Type |
|--------|------|
| `payment_method` | `payment_method` PK |

---

## 5. Views — columns 1:1

### `v_doctor_ratings`

| Column | Type |
|--------|------|
| `doctor_id` | uuid \| null |
| `average_rating` | number \| null |
| `review_count` | number \| null |

### `v_daily_booking_summary`

| Column | Type |
|--------|------|
| `appointment_date` | date \| null |
| `total_bookings` | number \| null |
| `completed_count` | number \| null |
| `paid_count` | number \| null |
| `unpaid_count` | number \| null |
| `no_show_count` | number \| null |
| `revenue` | number \| null |

### `v_unpaid_completed_visits`

| Column | Type |
|--------|------|
| `booking_id` | uuid \| null |
| `patient_id` | uuid \| null |
| `patient_code` | text \| null |
| `patient_name` | text \| null |
| `doctor_id` | uuid \| null |
| `doctor_name` | text \| null |
| `appointment_date` | date \| null |
| `amount_due` | number \| null |
| `payment_status` | `payment_status` \| null |

### `v_pending_follow_ups`

| Column | Type |
|--------|------|
| `follow_up_id` | uuid \| null |
| `patient_id` | uuid \| null |
| `patient_name` | text \| null |
| `doctor_id` | uuid \| null |
| `doctor_name` | text \| null |
| `follow_up_date` | date \| null |
| `reason` | text \| null |
| `status` | `follow_up_status` \| null |

---

## 6. Nested join shapes (PostgREST embeds)

Frontend uses Supabase nested selects. If .NET returns flat DTOs, either:

- Emulate the **same nested JSON** (see `dotnet-contract/WireModels.cs` nest DTOs), or  
- Change the frontend (out of scope for a 1:1 swap).

Supabase may return a **single object or a 1-element array** for many-to-one embeds; the FE uses `one()` in `src/lib/one.ts`. Prefer returning a **single object** for to-one nests, or support both.

### Common nests (exact embed strings)

```
doctors(staff_accounts(full_name))
doctors(staff_accounts(full_name, status))
doctors(staff_accounts(full_name, email))
doctors(staff_accounts(full_name, email, status))
doctors(specialization, staff_accounts(full_name))
patients(first_name, last_name)
patients(first_name, last_name, patient_code)
patients(first_name, last_name, patient_code, contact_number, email)
patients(first_name, last_name, contact_number, email, sex, date_of_birth)
patients(first_name, last_name, patient_code, contact_number, email, sex, date_of_birth)  // staff booking detail
booking_services(services(name))
booking_services(services(name, price))
payments(status)
prescription_line_items(*)
prescription_template_items(*)
consultation_diagnoses(custom_description)
consultation_diagnoses(custom_description, type)
follow_ups(follow_up_date, instructions)
bookings(appointment_date)
bookings(appointment_date, doctor_id)          // doctor patient chart — !inner filter
bookings(appointment_date, doctors(staff_accounts(full_name)))
bookings(doctors(staff_accounts(full_name)))
services(name, category, price)   // via doctor_services
```

Example response fragment the UI already unwraps:

```json
{
  "booking_id": "…",
  "doctors": {
    "staff_accounts": { "full_name": "Dr. Grace" }
  },
  "booking_services": [
    { "services": { "name": "Consultation" } }
  ],
  "payments": { "status": "Unpaid" }
}
```

(Supabase may return object **or** single-element array for many-to-one embeds; the app uses a `one()` helper in `src/lib/one.ts`.)

---

## 7. Auth APIs the frontend calls

There is **no** custom Next.js REST API under `src/app/api/**`. Auth is Supabase Auth.

| Call | Where | Inputs | What FE reads |
|------|-------|--------|---------------|
| `auth.getUser()` | middleware, SessionProvider, server actions, some doctor pages | session cookie | `user.id`, sometimes `user.email` |
| `auth.onAuthStateChange` | SessionProvider | — | reload session |
| `auth.signInWithPassword({ email, password })` | login, booking, profile password verify | email, password | `data.user` or error |
| `auth.signUp({ email, password })` | booking register | email, password | `data.user` then `registerPatientAccount` |
| `auth.signOut()` | `GET /logout` | — | redirect `/login` |
| `auth.resetPasswordForEmail(email, { redirectTo })` | forgot-password | email; `redirectTo` = `{origin}/login` today | error only |
| `auth.updateUser({ password })` | patient/staff/doctor profile | new password | error only |
| `auth.resend({ type: "signup", email })` | patient dashboard | email | error only |
| `auth.admin.inviteUserByEmail(email)` | createDoctor, inviteStaffMember (service role) | email | `user.id` |
| `auth.admin.deleteUser(userId)` | rollback / revoke invite | user id | — |

**Gap:** no `/auth/callback` or reset-password completion page in the app today.

---

## 8. Storage

| Constant / value | Meaning |
|------------------|---------|
| Bucket `patient-documents` | Patient document uploads |
| Bucket `patient-lab-results` | Lab result file uploads |
| Max size | 10 MB |
| Path pattern | `{patientId}/{bookingId}/{timestamp}-{sanitizedFileName}` |
| Upload opts | `cacheControl: "3600"`, `upsert: false`, `contentType` |
| After upload | `getPublicUrl` → store `file_url` on DB row |

Allowed MIME: pdf, jpeg, png, webp, gif, msword, docx (`src/lib/patientUploads.ts`).

Helper return (TS, camelCase — **internal**, not PostgREST):

```ts
{ fileUrl, fileName, fileSize, contentType, error }
```

DB insert still uses snake_case: `file_url`, `file_name`, `file_size`, `file_content_type`.

---

## 9. Server actions (Next `"use server"` — not PostgREST)

These are **camelCase** TypeScript contracts between React and Next server actions. When moving to .NET, either keep Next actions as a BFF or expose equivalent endpoints and update callers.

### `registerPatientAccount`

- File: `src/app/actions/registerPatientAccount.ts`
- Input: `{ firstName, lastName, dateOfBirth, sex, contactNumber, email }`
- Output: `{ success: true, patientId } | { success: false, error }`
- DB writes (snake_case): `profiles` `{ id, role: "Patient" }`, `patients` `{ user_id, patient_code, first_name, last_name, date_of_birth, sex, contact_number, email, is_guest: false }`

### `inviteStaffMember`

- Input: `{ email, fullName, role: "Staff"|"Doctor"|"Admin" }`
- Output: `{ success: true, staffId } | { success: false, error }`
- DB: `profiles` + `staff_accounts` (`status: "Invited"`)

### `createDoctor`

- Input: `{ email, fullName, specialization, consultationFee, bio, licenseNumber, ptrNumber, s2Number, slotDurationMinutes, serviceIds, schedule }`
- Output: `{ success: true, doctorId } | { success: false, error }`
- DB: auth invite + `profiles` + `staff_accounts` + `doctors` + `doctor_services` + `doctor_schedules`

### `revokeStaffInvite`

- Input: `staffId: string`
- Output: `{ success: true } | { success: false, error }`
- Deletes auth user when status is `Invited`

---

## 10. Frontend API usage inventory (by resource)

Below: what the app **actually calls**. Returns are PostgREST rows using §4 column names unless noted.

### `profiles`

| Op | Select / payload | Filters | Callers |
|----|------------------|---------|---------|
| SELECT | `role` | `eq(id, user.id)` | login, middleware, SessionProvider, admin actions |
| SELECT | `id, role` | `eq(id, user.id)` | registerPatientAccount |
| INSERT | `{ id, role }` | — | register / invite / createDoctor |
| DELETE | — | `eq(id, user.id)` | register rollback |

### `patients`

| Op | Notes |
|----|-------|
| SELECT | `*`, or subsets: `patient_id, first_name, last_name`, dashboard `first_name, email, is_email_verified, consented_at`, list columns, etc. |
| INSERT | guest walk-in / admin create / register linked account |
| UPDATE | profile fields; consent `{ consented_at, consent_version }` |

### `staff_accounts`

| Op | Notes |
|----|-------|
| SELECT | session `staff_id, full_name, avatar_url`; admin list; profile; name map for announcements |
| INSERT | invite / createDoctor `{ user_id, full_name, email, role, status: "Invited" }` |
| UPDATE | `status`, `full_name`, `contact_number` |

### `doctors` + schedules / services / blocked / day status

Heavy use on booking, admin, walk-in, doctor profile/schedule. Nested `staff_accounts(...)` almost always present on doctor lists.

### `bookings` + `booking_services` + `payments`

Core create/list/detail/update flows for patient, staff, doctor, admin. Queue number from **count** of bookings for doctor+date. Walk-in sets `is_walk_in: true`, `payment_mode: "PayAtClinic"`.

### Clinical

- `consultations` upsert on `booking_id`
- replace-all `consultation_diagnoses`
- upsert/delete `follow_ups`
- vitals: `vital_field_templates` + `patient_vital_readings`
- Rx: `prescription_groups` + `prescription_line_items` + templates + favorites + `medicines`
- SOAP: `soap_templates`, `soap_phrases`
- `audit_logs` on amend

### Patient files / vax / reviews

- documents / lab_results inserts after storage upload
- vaccinations **read** only from UI lists today
- reviews insert `{ booking_id, doctor_id, patient_id, rating, comment }`

### Admin settings / reports

- `clinic_settings`, `clinic_operating_hours`, `clinic_accepted_payment_methods`
- views: `v_daily_booking_summary`, `v_unpaid_completed_visits`, `v_pending_follow_ups`, `v_doctor_ratings`

### Only Next route handler

- `GET /logout` → `auth.signOut()` → redirect `/login`

---

## 11. Public vs protected routes (middleware)

Public (no login): `/`, `/login`, `/forgot-password`, `/booking*`

Protected: `/{patient|staff|doctor|admin}/**` — role segment must match `profiles.role`.

Authenticated user on `/login` → redirect `/{segment}/dashboard`.

---

## 12. .NET conversion checklist (avoid the rename bug)

1. [ ] JSON property names = **snake_case** from §4–§5 (or `[JsonPropertyName]` on every field).
2. [ ] Enum strings = exact PascalCase values from §3 (`PayAtClinic`, not `PayAtClinicMode`).
3. [ ] Primary keys keep names: `patient_id`, `booking_id`, `staff_id`, `doctor_id`, `group_id`, `template_id`, etc.
4. [ ] Nested doctor name path still works: `doctors.staff_accounts.full_name` **or** change FE in a separate PR.
5. [ ] Dates/times as ISO / Postgres-compatible strings the JS client already parses.
6. [ ] Auth: either keep Supabase Auth temporarily, or replace with JWT that still exposes `user.id` the same way SessionProvider expects.
7. [ ] Storage: either keep Supabase Storage URLs in `file_url`, or return the same public URL shape.
8. [ ] Do **not** change server-action camelCase inputs until you change the TS callers (`firstName` vs `first_name` is a **different** layer).
9. [ ] Smoke-test: login → `profiles.role` → dashboard; create booking; staff payment update; doctor consultation save; patient profile load.

---

## 13. Suggested .NET endpoint map (optional)

If you replace PostgREST with REST, keep **response bodies** shaped like the table rows above. Example naming (paths can vary; **JSON keys cannot**):

| Suggested path | Mirrors |
|----------------|---------|
| `GET /api/patients/{patient_id}` | `patients` row |
| `GET /api/bookings?patient_id=` | booking list |
| `POST /api/bookings` | insert booking (+ optional booking_services, payments) |
| `GET /api/doctors` | doctors + nested staff_accounts |
| `PUT /api/consultations/by-booking/{booking_id}` | consultations upsert |
| `POST /api/auth/login` | replaces `signInWithPassword` (return session + role) |

Prefer returning the **same field names** the FE already reads after `.select(...)`.

---

## 14. Source files (for verification)

| Artifact | Path |
|----------|------|
| Generated DB types | `src/data/supabase-types.ts` |
| **Shared .NET wire DTOs** | `dotnet-contract/WireModels.cs` |
| Contract how-to | `dotnet-contract/README.md` |
| DDL | `supabase/schema.sql` |
| RLS | `supabase/rls.sql` |
| Storage | `supabase/storage.sql` |
| Browser client | `src/lib/supabase/client.ts` |
| Server client | `src/lib/supabase/server.ts` |
| Service role | `src/lib/supabase/admin.ts` |
| Session map | `src/components/providers/SessionProvider.tsx` |
| Middleware roles | `src/middleware.ts` |
| UI models (NOT wire) | `src/data/types.ts` |

---

## 15. Gaps / incomplete UI vs schema

| Item | Status |
|------|--------|
| `lab_orders` | Table exists; consultation UI does not persist yet |
| `patient_vaccinations` write from consultation | Local draft only; list pages **read** the table |
| `icd10_codes` | Seeded; no `.from("icd10_codes")` in UI |
| Password recovery completion | `resetPasswordForEmail` redirects to `/login` — no set-password page |
| Auth callback route | Missing |

---

## 16. Planned / candidate amendments (not yet in the live DB)

> Documented here so the .NET model can be built forward-compatible. **Nothing in this
> section is in `supabase-types.ts`, `schema.sql`, or the live database today.** Each
> item is optional and additive — a `null`-tolerant field on the wire until a
> migration lands. Do not treat these as required in §4.

### 16.1 Staff-recorded vitals at walk-in intake

**Scenario.** A patient walks in. Staff quick-registers them (`patients`, `is_guest`),
manually creates a `bookings` row (`is_walk_in: true`), then records basic vitals
(temperature, BP, weight, height, …) **before** the doctor sees the patient — instead
of vitals only being entered by the doctor inside the consultation page.

**Vitals capture is a shared capability, not a role hand-off.** Either the front-desk
staff **or** the doctor can enter/edit the basic vitals for a booking — whoever is
free. Normal case: staff does it at intake. If staff is busy, the doctor does it at the
start of the consultation. Same `patient_vital_readings` rows, same
`booking_id,template_id` upsert key, so the second person edits in place rather than
creating a duplicate set. `recorded_by_user_id` (below) records who actually entered
each reading. The .NET write endpoint therefore authorizes **any** `is_staff_like()`
user (Staff / Doctor / Admin), not doctor-only and not staff-only.

**Already in place (no change needed):**

- `patient_vital_readings` keys on `booking_id` + `template_id` (the booking exists by
  the time vitals are taken), `value` is free text (`"128/82"`), upsert key
  `booking_id,template_id` lets the doctor later amend a staff-entered reading.
- The 7 default `vital_field_templates` (`temperature`, `blood_pressure`, `weight`,
  `height`, `pulse_rate`, `respiratory_rate`, `o2_saturation`) are seeded.
- RLS policy `patient_vital_readings_write_staff` already allows **any** `is_staff_like()`
  user (Staff / Doctor / Admin) to insert/update — a Staff user can write vitals today
  at the DB level. Only the **UI** for a staff-side vitals step is missing.

**Proposed schema change (one column):**

```sql
alter table patient_vital_readings
  add column recorded_by_user_id uuid references auth.users(id) on delete set null;
```

Rationale: today `recorded_at` is only a date and there is no way to tell an
intake reading (entered by front-desk staff) from a consultation reading (entered by
the doctor). This column makes that distinction auditable. Nullable, so existing rows
and any client that omits it stay valid.

**Wire delta:** add `recorded_by_user_id` (`string | null`) to `PatientVitalReadingRow`
in `dotnet-contract/WireModels.cs` — already stubbed there with a `PROPOSED` comment.

**Contract-inventory delta (when it ships):** in §10 → *Clinical*, list **Staff** as a
writer of `patient_vital_readings` alongside Doctor (both roles, shared — see scenario
above), and drop the "consultation vitals" framing in §15.

**Frontend delta (when it ships):** a vitals step in `src/app/staff/walk-in/**` or a
panel on `src/app/staff/bookings/[id]/**`, **and** keep the existing vitals step in the
doctor consultation page — both reuse `src/components/doctor/VitalsEditor.tsx` and both
write the same rows.

### 16.2 Server-side pagination + search for list screens

**Problem.** Every list screen today (`doctor/patients`, `staff/patients`,
`admin/patients`, `admin/bookings`, `staff/payments`, …) does a single unfiltered
`.select(...)` and then filters / sorts **client-side**. That is fine for demo data
and breaks well before patient or booking rows reach the tens of thousands —
independent of whether the UI renders cards or a table. (The `doctor/patients` list is
also still a `<Card>` grid; it should move to the existing
`src/components/ui/DataTable.tsx`, but that is a UI change with no wire impact.)

**Direction (applies whenever a list endpoint is put behind .NET):**

- **Keyset / cursor pagination**, not offset — stable under inserts, cheap at depth.
  Page size ~25–50.
- Server-side **search** and **sort**. Patients: `patient_code`, `last_name`,
  `first_name`, `contact_number` (indexes on `patient_code`, `user_id` already exist;
  add `last_name` / trigram indexes as needed). Bookings: `appointment_date` range +
  `status` + `doctor_id` + `patient_id`.
- Default order stays as the FE expects it today (e.g. visit history
  `appointment_date` **descending** — see §10).

**Request params (suggested, snake_case):**

| Param | Meaning |
|-------|---------|
| `limit` | page size (server caps, e.g. ≤100) |
| `cursor` | opaque keyset cursor from the previous page; omit for page 1 |
| `q` | free-text search term |
| `sort` | column name; prefix `-` for descending (e.g. `-appointment_date`) |
| resource filters | `status`, `doctor_id`, `patient_id`, `date_from`, `date_to`, … |

**Response envelope (suggested):**

```json
{
  "rows": [ /* array of the §4 row shape for that resource — keys unchanged */ ],
  "next_cursor": "opaque-string-or-null",
  "total": 12345
}
```

`total` optional (can be expensive); `next_cursor: null` means last page. **The row
objects inside `rows` keep the exact §4 / §6 field names and nested-embed shapes** —
pagination only wraps them, it never renames or flattens them.

**Contract-inventory delta (when it ships):** update the affected rows in §10 and the
endpoint map in §13 to show the paged envelope instead of a bare array. Endpoints that
return a single record (`GET /api/patients/{patient_id}`) are unaffected.

**Frontend delta (when it ships):** list pages switch from "fetch all + filter in
memory" to passing `limit` / `cursor` / `q` / `sort` and appending pages; `DataTable`
already supports column sorting and can drive `sort`.

### 16.3 Walk-in intake flow (staff) + FCFS consultation queue + queue-ticket printing

**This is the clinic's primary workflow — first-come, first-served, not appointment-slot
based.** Captured from the clinic owner, 2026-09-09:

1. Patient walks in. Staff searches by name / `patient_code` (server-side search per §16.2).
2. Match → open that patient. No match → quick-register a new `patients` row
   (`is_guest`, `user_id` null — already supported, RLS `patients_insert_staff`).
3. Staff creates the `bookings` row (`is_walk_in: true`,
   `payment_mode: "PayAtClinic"`, plus a `payments` row) — already supported.
4. Staff records basic vitals against that `booking_id` (§16.1;
   `recorded_by_user_id` distinguishes intake vs consultation).
5. **Staff adds the patient to the doctor's consultation queue** — an explicit action,
   a status transition on the booking (see "Status flow" below).
6. Print a queue ticket.
7. **Doctor** opens their queue = the day's bookings for that doctor, **ordered by
   arrival (FCFS)**, and works the top of the list: opens the top patient → starts the
   consultation (status → `InProgress`) → during / at the end of it **tags the visit**
   (`visit_type` = `New` / `FollowUp`), issues any prescription / med-cert / lab
   request → completes it (status → `Completed`). The server finalises the fee here
   (§16.6 "Fee timing").
8. **Staff collects the money** — the existing staff payment-confirm flow (§10),
   against the fee the consultation-complete step finalised.

**Contract implications:**

- **No new tables** for steps 1–8. Covered by existing `patients` / `bookings` /
  `payments` / `patient_vital_readings` + §16.1's one proposed column. (Printable
  clinical documents in step 7 — see §16.7; the doctor's earnings view — see §16.9.)

- **FCFS ordering — the current implementation is wrong.** Today `queue_number` is a
  client-computed string `` `${doctorInitial}-${count+1}` `` (`staff/walk-in`,
  `admin/walk-in`) and the doctor dashboard sorts it with `localeCompare` — so
  `"D-10"` sorts before `"D-2"`, and two concurrent walk-ins get the **same** number
  (the `count(*)` is not atomic). For .NET:
  - Assign the queue position **server-side** in the create-booking transaction, as a
    real **integer** per (doctor, `appointment_date`) — e.g. a new
    `bookings.queue_position int` column, or derive strictly from `created_at`.
  - Keep the human-facing `queue_number` string (ticket display) if desired, but never
    sort by it. Wire types: keep `queue_number: string | null`; add
    `queue_position: number | null` if adopted (→ §4, WireModels, supabase-types).

- **Walk-in `slot_start_time` / `slot_end_time` are semantically empty for FCFS.**
  The walk-in pages currently shoehorn a slot in (`parseSlotTo24h(slot)` +
  `slotDurationMinutes`). Decide: either set them to the arrival timestamp, or make
  both nullable and let `is_walk_in = true` + `queue_position` carry the ordering.
  The scheduled patient-facing `/booking` wizard still uses real slots — the two
  models coexist on one `bookings` table.

- **Status flow (walk-in) — needs to be defined and enforced server-side.** Current
  code is inconsistent: walk-in inserts `status: "Pending"`, but the doctor dashboard
  treats `"Confirmed"` as "waiting" and also counts `"CheckedIn"` separately, with no
  code path moving a walk-in between them. Proposed canonical flow:

  ```
  Pending  →  CheckedIn (staff: "add to consultation queue", step 5)
           →  InProgress (doctor: "start consultation", step 7)
           →  Completed  (doctor: "finish")
  ```
  `Cancelled` / `NoShow` are terminal off-ramps. The doctor's queue = bookings for
  that doctor + date with `status = 'CheckedIn'`, ordered by `queue_position`;
  "up next" is the first such row. Whatever transitions are chosen, document the legal
  set (see §17.3 #16) and reject illegal ones at the API, not just the UI.

- **Queue-ticket payload.** A stable projection the create-booking response (or
  `GET /api/bookings/{booking_id}`) must include: `queue_number` /
  `queue_position`, patient `first_name` / `last_name` / `patient_code`,
  `doctors.staff_accounts.full_name`, `appointment_date`,
  `clinic_settings.clinic_name` / `logo_url`. All in §4 / §6 — just make sure the
  create response carries the doctor + patient nests.

**Printing mechanism (FE concern, noted for completeness — no contract change):**

- Simplest: a print-friendly HTML ticket + `window.print()`; the browser targets
  whatever printer the OS exposes (including a thermal printer installed as a system
  printer). This is how `src/lib/print.ts` already works for prescriptions.
- Direct thermal (ESC/POS) from the browser is possible via **WebUSB** or **Web
  Serial** (Chromium only, requires a user gesture + per-device permission prompt,
  HTTPS). More work, no server involvement, and out of scope for the contract.
- Either way the backend only supplies the ticket data above; it does not talk to
  the printer.

### 16.4 Performance — target: data pages usable in < 1 s

**Current state (as-built FE, honest assessment):** built like a client-side SPA.
46 / 55 `page.tsx` are `"use client"` and fetch in `useEffect` **after** bundle
download + hydration. Every data page pays: bundle+hydrate → `SessionProvider` does
`auth.getUser()` → `profiles` → `patients`/`staff_accounts` (**3 sequential
round-trips just to identify the user**) → **then** the page's own `.select()` calls.
`proxy.ts` adds another `auth.getUser()` + `profiles` query per navigation. No
pagination; `select("*")` + nested embeds everywhere. Realistic dashboard load today
≈ 2–4 s. Static pages (`/`, `/login`) are already fine.

Sub-1 s for data-backed pages is **not reachable without the rework below** — it is an
architecture problem, not a tuning problem.

**Backend/API-shape implications (the parts this contract cares about):**

- **One call per screen.** Each screen gets a purpose-built endpoint that returns
  exactly its data in a single server-to-server response, replacing 3–5 browser
  round-trips. Response bodies still use §4 / §6 field names and nested shapes.
- **Session in one round-trip.** Provide a single endpoint / RPC that returns
  `{ user_id, role, staff_id, patient_id, display_name, avatar_url }` in one call
  (replaces the current 3-query `SessionProvider` chain and the middleware re-query).
  Keep these keys snake_case on the wire; the FE maps to `SessionInfo` (§2).
- **Server-side pagination** on every list endpoint (§16.2) — mandatory.
- **Cacheable reference data.** `services`, `vital_field_templates`,
  `clinic_settings`, `clinic_operating_hours`, `clinic_accepted_payment_methods`,
  `icd10_codes`, `medicines`, active-doctor lists change rarely — serve with
  cache headers (ETag / `Cache-Control`) so the FE can `revalidate` instead of
  refetching per load.
- **Narrow projections.** Endpoints return explicit column sets, not `select("*")`;
  drop embed branches a screen does not render.
- **Auth token check** should not require a network round-trip per request on the
  .NET side — validate the JWT locally (signing key), not by calling out.

**FE-side implications (out of scope for the .NET swap itself, listed for the coding
phase):** move fetching into async Server Components (9 pages already do — make it the
default), keep `"use client"` at interactive leaves only, resolve session in a server
layout, lazy-load / shrink the FontAwesome icon packs, add `revalidate` to reference
data.

### 16.5 Responsive & non-technical usability (FE audit — no contract impact)

Recorded here so the coding phase has a baseline. **No .NET / wire impact** — this is
all FE + design.

**Responsive — foundation is good:**

- `AppShell` is flex-based with a **real** off-canvas mobile drawer (the as-built
  notes say ~28 exported screens had a decorative, non-functional hamburger — fixed).
- Sidebar `hidden md:flex`; Topbar hamburger `md:hidden`; global search hidden
  `< sm`; user name hidden `< lg`.
- ~123 `sm:` / 18 `md:` / 17 `lg:` breakpoint utilities — real work, not tokenism.
- `DataTable` has `renderMobileCard` → stacked cards below `sm`, adopted on 12
  high-traffic list screens; default is an `overflow-x-auto` table.
- Type scale ships `*-mobile` size variants; content capped at `max-w-content`
  (1440px) so big screens don't stretch to unreadable line lengths.
- Next injects the `width=device-width` viewport tag by default (not overridden).

**Responsive — gaps to fix in the coding phase:**

- **Hand-rolled `<table>` on detail/dashboard screens** (`doctor/patients/[id]`,
  `doctor/dashboard`, `admin/calendar`, `admin/reports`, `staff/dashboard`,
  `patient/doctors/[id]`) are **not** `DataTable` — no mobile-card fallback. Most have
  an `overflow-x-auto` wrapper; `patient/vaccinations` does not. The vitals matrix
  (bookings × templates) is very wide on a phone.
- **Touch targets too small.** Only 3 elements hit ~44–48px. Icon buttons (Topbar
  hamburger / bell, `DataTable` pagination chevrons) use `p-xs` (4px) → ~24–28px,
  below the 44px iOS / WCAG 2.5.5 minimum. The likely doctor device is a tablet.
- **No real-device QA evidence** (iPhone / Android / iPad / 4K). "Should work" is not
  "tested" — add a device matrix pass.
- **`xl:` used twice, `2xl:` never** — a 24–27″ clinic monitor gets laptop layout +
  dead margin. Not broken; a conscious "do we use wide screens" decision is owed.

**Non-technical usability (the "lazy old non-techy doctor" test) — mixed:**

- *Working for them:* one consistent shell across all screens; role-scoped nav (a
  doctor only sees doctor screens); `loading.tsx` skeletons; `EmptyState` explains
  empty lists; `StatusPill` colour-codes status; confirm-`Modal` is used on
  destructive actions across ~10 screens; row prefetch-on-hover.
- *Working against them:*
  - **Small text** — body 14px, labels 11–13px, no user text-scaling control. Rough
    for 60+ eyes.
  - **Small / icon-only controls** — bell, hamburger, pagination arrows have no
    visible label (only `aria-label`); a confused sighted user gets no text.
  - **Slow perceived load** — the §16.4 waterfall means 2–4 s of "Loading…" per
    screen; non-technical users read slow as broken and start re-clicking.
  - **Form labelling** — ~46 `<label>` for ~173 inputs/selects; many fields are
    placeholder-only (e.g. Topbar search). Fails screen readers and hurts clarity.
  - **No onboarding / tooltips / inline help** anywhere; first run is "figure it out".
  - Focus-visible / keyboard-nav / screen-reader passes not evidenced.

---

### 16.6 Fee schedule + booking tagging (follow-up / senior-PWD / med-cert)

**Captured from the clinic owner, 2026-09-09.** Fee schedule:

| Visit / add-on | Fee (₱) |
|----------------|---------|
| Standard consultation | 450 |
| Senior citizen / PWD consultation | 400 |
| Follow-up consultation | 350 |
| Medical Certificate (add-on) | +50 |

**Concrete ask:** *staff must be able to tag a booking as **follow-up** or not* — the
tag changes the price (450 → 350).

**Current state (gaps):**

- `bookings` has **no follow-up flag**. The `follow_ups` table is a different concept
  (a doctor-scheduled clinical follow-up: `consultation_id`, `follow_up_date`,
  `status`) — it is **not** a per-booking pricing tag and must not be overloaded as one.
- No **senior / PWD** concept anywhere — `patients` has no `is_senior` / `is_pwd` /
  ID-number columns, and there is no per-booking discount field.
- No **fee schedule** storage. Today `consultation_fee_snapshot` is copied from
  `doctors.consultation_fee` (per-doctor), and `total_fee` / `amount_due` are computed
  client-side in the walk-in pages. The four amounts above are clinic-wide flat rates,
  not per-doctor — a different model.
- **Medical Certificate** has no backing entity at all (see the printable-documents
  gap in §16.7) — so "+50 when a med-cert is issued" has nothing to attach to yet.

**Proposed shape (design-level — confirm before building):**

- **Follow-up tag:** `bookings.visit_type` enum `('New', 'FollowUp')` (or
  `is_follow_up boolean`). **Per the doctor (2026-09-09): the _doctor_ sets this during
  / at the end of the consultation, not staff at booking creation.** Consequence: the
  fee cannot be finalised at booking time — see "Fee timing" below. New enum → §3 / §4
  / WireModels / supabase-types.
- **Senior / PWD:** treat as a **patient** attribute (it is a property of the person,
  and the discount recurs every visit): `patients.pwd_id_number text | null`,
  `patients.senior_id_number text | null` (presence ⇒ eligible), plus a per-booking
  snapshot `bookings.discount_category text | null`
  (`'None' | 'Senior' | 'PWD'`) so a historical booking keeps the rate it was billed
  at even if the patient record changes later. PH law (RA 9994 / RA 10754) mandates
  these discounts, so this is not optional long-term.
- **Med-cert add-on:** model as a catalog `services` row (`name = 'Medical
  Certificate'`, `price = 50`, `category = 'Procedure'`) added to `booking_services`
  when the doctor issues the certificate — reuses the existing snapshot mechanism, and
  the fee recompute below picks it up. No new column.
- **Fee schedule storage:** either add fee columns to `clinic_settings`
  (`fee_consultation`, `fee_follow_up`, `fee_senior_pwd`, `fee_med_cert`) or a small
  `fee_schedule` table. Do **not** hard-code 450/400/350/50 in code.
- **Server-side fee computation** (also see §17 — business logic must leave the browser).
  Working model, per the parked-questions assumption (senior/PWD = −20% of total):

  ```
  base            = visit_type = 'FollowUp' ? fee_follow_up : fee_consultation
  addons          = sum(booking_services.price_at_booking)   -- includes med-cert if issued
  gross           = base + addons
  discount_amount = discount_category = 'None' ? 0
                  : round(clinic_settings.discount_pct * gross, 2)   -- discount_pct = 0.20
  total_fee       = gross - discount_amount
  amount_due      = total_fee - (payments confirmed so far)
  ```
  `consultation_fee_snapshot` = `base` (keep the column; its meaning becomes "the base
  visit fee actually billed", no longer just the doctor's list price). Store
  `discount_amount` on the booking so a historical bill is reproducible.

- **Fee timing (per the doctor, 2026-09-09).** Order of events is:
  `secretary reserves + queues` → `doctor consults + tags visit_type (+ issues
  med-cert / labs)` → `secretary collects money`. So:
  - At booking creation the fee is **provisional / not yet due** — `visit_type` is
    unknown, `payments` row starts `Unpaid` with `amount = 0` or the default
    consultation base as a placeholder.
  - When the doctor **completes the consultation** (sets `visit_type`, adds any
    `booking_services`), the server **recomputes** `bookings.total_fee` /
    `amount_due` and syncs `payments.amount`.
  - The secretary's "collect payment" step then confirms `payments` against that
    final amount (existing staff payment-confirm flow, §10).
  - Endpoint shape: fee recompute belongs to the consultation-complete call and to
    any later edit of `visit_type` / `booking_services`; never to booking creation.

**Open questions — PARKED (owner undecided as of 2026-09-09, do not build yet):**

Working assumption to code against until the owner confirms: **senior / PWD = −20% off
the total bill** (applied after add-ons), not a flat ₱400. This matches PH law
(RA 9994 / RA 10754) and is why `bookings` needs a stored `discount_category` +
`discount_amount` snapshot rather than a second flat-rate column. Revisit:

1. Do discounts **stack**? e.g. senior **and** follow-up — is it −20% off the ₱350
   follow-up rate, or "best single rate"?
2. Does the −20% apply to the med-cert +₱50 line too, or only the consultation base?
3. Confirm −20%-off-total vs any flat rate; confirm whether VAT exemption matters for
   this clinic's setup.
4. **Per-doctor** fees (current `doctors.consultation_fee`) vs the **clinic-wide** flat
   schedule above — which wins? Can a specialist charge more?
5. Who can change a booking's `visit_type` / `discount_category` after payment is
   confirmed — anyone, admin only, no one?

Until resolved: build the `visit_type` tag (doctor-set at consultation) and the
`discount_category` field now, compute `discount_amount` as `round(0.20 * gross, 2)`
when `discount_category != 'None'`, keep the percentage in `clinic_settings` so it is a
one-line change later.

**Checklist:** tracked under §18 group **E** (booking fields + fee schedule) and
group **L** (doctor earnings dashboard, §16.9).

---

### 16.7 Printable clinical documents — prescription, medical certificate, lab request

**Captured 2026-09-09.** At the end of a consultation the doctor prints up to three
documents: **prescription**, **medical certificate**, **lab request** (additional
labs). Current backing:

| Document | Backing today | Gap |
|----------|---------------|-----|
| Prescription | `prescription_groups` + `prescription_line_items` (real tables), printed via `src/lib/print.ts` | None — works. Keep. |
| Lab request | `lab_orders` table **exists** in schema, but the consultation UI holds them in React state only (`LabOrderDraft`, "no real table yet" comment) and never `.from("lab_orders")` | **Wire it up** — persist on consultation save. No new table. |
| Medical certificate | **Nothing.** Only a `prescription_templates` row titled "Medical Certificate" + a `types.ts` comment. | **New table needed.** |

#### New table: `medical_certificates`

Follows the exact pattern of `follow_ups` / `lab_orders` / `prescription_groups`
(child of `consultations`, with `patient_id` / `doctor_id` denormalized for the same
RLS-performance reason the schema comments already cite):

```sql
create table medical_certificates (
  certificate_id   uuid primary key default gen_random_uuid(),
  consultation_id  uuid not null references consultations(consultation_id) on delete cascade,
  patient_id       uuid not null references patients(patient_id)          on delete restrict,
  doctor_id        uuid not null references doctors(doctor_id)            on delete restrict,
  -- content
  diagnosis_text   text,                 -- free text as printed (may differ from consultation_diagnoses)
  recommendation   text,                 -- "advised X days rest", "fit to return to work/school", etc.
  rest_start_date  date,
  rest_end_date    date,
  purpose          text,                 -- "for school", "for employer", "for absence"
  remarks          text,
  -- issuance / audit
  issued_at        timestamptz not null default now(),
  issued_by_user_id uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_medical_certificates_consultation_id on medical_certificates(consultation_id);
create index idx_medical_certificates_patient_id on medical_certificates(patient_id);
```

- **Cardinality:** 0..N per consultation (usually 0 or 1). Not `unique` on
  `consultation_id` — a patient can need a second cert for a different purpose.
- **Doctor identity for the printout** (license no., PTR no.) is **not** copied here —
  read it live from `doctors.license_number` / `doctors.ptr_number` at print time.
- **Fee link:** issuing a certificate inserts the `services` "Medical Certificate"
  (₱50) row into `booking_services` (per §16.6) → fee engine recomputes `total_fee` /
  `amount_due`. Alternatively the fee engine can check
  `exists(medical_certificates for this booking's consultation)`; the `booking_services`
  row is preferred so all add-ons flow through one mechanism.

#### Wire / contract deltas (when it ships)

- New DTO `MedicalCertificateRow` in `dotnet-contract/WireModels.cs`, snake_case, all
  fields above.
- Add the table to §4, and to `src/data/supabase-types.ts` when regenerated.
- `lab_orders`: no shape change — add it to the §10 inventory as a **write** path
  (consultation save) and drop it from the §15 "not persisted" gap list.
- **Print payload** for each of the three docs = a stable projection the API returns
  (like the queue ticket in §16.3): patient name / `patient_code` / DOB, doctor
  `full_name` + `license_number` + `ptr_number`, `clinic_settings` name / address /
  contact / `logo_url`, plus the document's own rows. Keep §4/§6 field names.

#### Frontend deltas (when it ships)

- Consultation page: persist lab orders to `lab_orders` on save; add a "Medical
  Certificate" sub-form that writes `medical_certificates` + the `booking_services`
  fee row.
- Print: reuse `src/lib/print.ts` `printHtml()` for all three (it already has the
  table + slip styles).

---

### 16.8 Clinic's actual paper forms — ground truth (owner visit, 2026-09-09)

Photos of the clinic's real Rx pad, Medical Certificate, and Lab Request form. The
schema/seed must be corrected to match these, and three forms drive concrete field
changes below.

#### Real clinic identity — correct the seed + `clinic_settings`

| Field | Current (schema seed / app) | **Actual (from letterhead)** |
|-------|-----------------------------|------------------------------|
| Clinic name | "Dr. Grace Gavino Medical Clinic" | **GRACE MEDICAL CLINIC** |
| Doctor name | "Dr. Grace Gavino" | **ALLYN GRACE T. ESPAÑA-GAVINO, MD** |
| Credentials line 1 | — | FAMILY AND COMMUNITY MEDICINE |
| Credentials line 2 | — | ADULT AND PEDIA |
| Address | "TBD" | 3ML Quezon National Highway, Buaya, Lapu-Lapu City |
| Contact | — | 09285612976 |
| License No. | — | **0125232** |
| PTR No. | — | (blank on pad — renewed yearly, entered per-year) |
| Hours | single open/close per day | **Mon–Fri 10:00–17:00 _and_ 19:00–20:00; Sat 10:00–17:00** |

- App title string (`src/app/layout.tsx` `metadata.title`) and the schema seed
  (`clinic_settings`) both say "Dr. Grace Gavino Medical Clinic" — update to
  "Grace Medical Clinic". Low risk (`clinic_settings.clinic_name` is editable).
- **`doctors.license_number` / `doctors.ptr_number` already exist** — seed the doctor
  row with license `0125232`. PTR is per-year; keep it editable.
- **Doctor credentials are two lines** on the form; `doctors.specialization` is one
  `text` column. Either store `"Family and Community Medicine"` there and treat
  "Adult and Pedia" as a print-time constant, or add `doctors.subspecialty text`.

#### ⚠ Structural: split-shift hours don't fit the schema

`clinic_operating_hours` is `day_of_week PK, is_closed, open_time, close_time` — **one
session per day**. `doctor_schedules` has `unique (doctor_id, day_of_week)` — same
limit. The clinic runs a **morning + evening session** Mon–Fri (10–5, then 7–8pm),
which cannot be represented today. Fix (pick one):

- Drop the per-day uniqueness; allow **N rows per day** (session rows), each with its
  own `start_time` / `end_time`. Cleanest; the booking-slot generator iterates rows.
- Or add a second pair (`open_time_2` / `close_time_2`) — quick but caps at two
  sessions and is ugly.

This changes `clinic_operating_hours`, `doctor_schedules`, the `onConflict:
"doctor_id,day_of_week"` upsert in `doctor/schedule`, and the slot math in
`src/lib/bookingTime.ts`. → §4, §10, WireModels, supabase-types.

#### Form 1 — Prescription (Rx pad): fields `prescription_line_items` is missing

Per medicine row the paper form captures: `#` (qty) · `Sig.` · `before/after` (meals) ·
`BREAKFAST–LUNCH–DINNER–BEDTIME` (timing, may be multiple) · `DURATION` = `Maintain`
_or_ `___ Days` _or_ `___ Weeks` · `INDICATION`. Plus footer "Next appointment".

Current `prescription_line_items`: `generic_name, dosage, quantity, instruction,
is_controlled_substance`. **Missing structured columns** (today everything is crammed
into `instruction`):

| Add column | Type | From form |
|------------|------|-----------|
| `timing` | `text` or `text[]` | which of Breakfast/Lunch/Dinner/Bedtime |
| `meal_relation` | `text` (`Before` \| `After` \| null) | "before/ after" |
| `duration_kind` | `text` (`Maintain` \| `Days` \| `Weeks`) | the DURATION checkbox |
| `duration_value` | `integer` \| null | the "___ Days/Weeks" number (null when Maintain) |
| `indication` | `text` \| null | the INDICATION column (distinct from `instruction`/Sig.) |

- Keep `generic_name` (PH generics law — the drug line). `dosage` stays (strength).
- "Next appointment" on the pad = a prescription-group-level follow-up date. Reuse
  `follow_ups` (already links `consultation_id`) or add
  `prescription_groups.next_appointment_date date | null` if it must print without a
  full follow-up record.
- The 5-row grid is just a print layout — data model stays "N line items per group".

#### Form 2 — Medical Certificate: revise the §16.7 `medical_certificates` columns

The real form's blanks (not "rest days from/to" as §16.7 assumed):

```
Date
"This is to certify that Mr./Ms./Mrs. {patient name}"
"residing at {address}"                    -- snapshot patient address at issue time
"has been examined in {place}"             -- facility examined at (usually the clinic)
"on {date_from} until {date_to}."          -- examination / treatment period
"Diagnosis/ Impressions: {free text, ~3 lines}"
"Recommendations: {free text, ~3 lines}"
[fixed boilerplate — print-time constant, not stored:]
  "This certificate is issued upon the request for whatever purpose it may serve
   except ______ and may not be used for medico-legal purposes."
"Please come back on: {follow-up date}"
{doctor name} / License No. {from doctors} / PTR No. {from doctors}
```

Revised table (replaces the §16.7 draft):

```sql
create table medical_certificates (
  certificate_id     uuid primary key default gen_random_uuid(),
  consultation_id    uuid not null references consultations(consultation_id) on delete cascade,
  patient_id         uuid not null references patients(patient_id)           on delete restrict,
  doctor_id          uuid not null references doctors(doctor_id)             on delete restrict,
  issue_date         date not null default current_date,
  patient_address_snapshot text,             -- "residing at ..."
  examined_at        text,                   -- "has been examined in ..." (place)
  examination_date_from date,                -- "on ... "
  examination_date_to   date,                -- "until ..."
  diagnosis_text     text,                   -- Diagnosis/ Impressions
  recommendations    text,                   -- Recommendations
  purpose_exception  text,                   -- the "except ______" blank (optional)
  come_back_on       date,                   -- "Please come back on:"
  issued_by_user_id  uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
```

Dropped from the §16.7 draft: `rest_start_date` / `rest_end_date` / `recommendation`
(singular) / `remarks` / `purpose`. Doctor license/PTR still read live from `doctors`.

#### Form 3 — Lab Request: needs a test catalog; revise `lab_orders` use

The form is a **checkbox list of a standard panel** plus handwritten free additions:

- Pre-printed: **CBC, URINALYSIS, LIPID PROFILE, SGPT, CREA, FBS, BUA, DENGUE NS1/IgG/IgM, ECG 12L**
- Handwritten on the sample: **TSH, FT3, FT4, HbA1c** (free-text additions)

Add a small catalog (same shape as `medicines` / `vital_field_templates`):

```sql
create table lab_test_catalog (
  lab_test_id uuid primary key default gen_random_uuid(),
  name        text not null unique,          -- 'CBC', 'URINALYSIS', 'ECG 12L', ...
  is_default  boolean not null default false,-- true for the 9 pre-printed rows
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
```

- `lab_orders` gains `lab_test_id uuid | null references lab_test_catalog` alongside
  the existing free-text `test_name` (denormalized copy, like prescriptions) — checked
  box ⇒ `lab_test_id` set; handwritten ⇒ `lab_test_id` null, `test_name` free.
- One `lab_orders` row per test. If a single printed request sheet needs to be one
  trackable unit, add `lab_order_groups` (consultation_id, created_at) + FK on
  `lab_orders.group_id` — mirrors `prescription_groups`. Decide with the owner.
- Seed `lab_test_catalog` with the 9 pre-printed tests (`is_default = true`) + the
  four common add-ons.
- → §4, §10 (lab_orders becomes a real write path — drop from §15), WireModels,
  supabase-types.

#### Shared print letterhead (all 3 forms are identical up top)

One print-header block, fed by `clinic_settings` (name, address, contact, hours,
`logo_url`) + `doctors` (full name, credentials, `license_number`, `ptr_number`).
Matches the §16.7 print-payload projection — just confirm the exact fields above.

#### Checklist

Tracked under §18 group **I** (forms → tables) and group **E** (clinic identity seed +
split-shift hours).

---

### 16.9 Doctor earnings / visits dashboard (doctor-only)

**Captured from the doctor, 2026-09-09.** The doctor wants their own dashboard showing,
for a chosen period (**daily / weekly / monthly**):

- number of patient visits
- total money collected

**Doctor-only** — not visible to Staff; Admin has the clinic-wide equivalent already
(`admin/reports` + `v_daily_booking_summary`).

**What exists:**

- `v_daily_booking_summary` (`appointment_date`, `total_bookings`, `completed_count`,
  `paid_count`, `unpaid_count`, `no_show_count`, `revenue`) — **not doctor-scoped**;
  it aggregates the whole clinic. A doctor querying it would see everyone's revenue.
- The doctor dashboard (`src/app/doctor/dashboard/page.tsx`) shows only today's queue +
  day status — no history, no money.

**Proposed:**

- **New view `v_doctor_period_summary`** (or a parameterised endpoint) grouped by
  `doctor_id` + `appointment_date`:

  ```sql
  create view v_doctor_period_summary as
  select
    b.doctor_id,
    b.appointment_date,
    count(*) filter (where b.status = 'Completed')            as visits,
    coalesce(sum(pay.amount) filter (where pay.status = 'Paid'), 0) as collected
  from bookings b
  left join payments pay on pay.booking_id = b.booking_id
  group by b.doctor_id, b.appointment_date;
  ```
  Daily / weekly / monthly rollup is done by the API or FE by summing rows in the
  date range (`date_trunc('week' | 'month', appointment_date)`), so the view stays one
  row per day and the client picks the granularity.

- **Authorization (critical):** a doctor may read **only their own** `doctor_id` rows.
  - Supabase today: give the view `security_invoker = on` (so base-table RLS applies)
    **or** add an RLS-style predicate; a plain view runs as owner and would leak.
  - .NET: the endpoint filters `doctor_id = current_doctor_id()`; Staff role → 403;
    Admin → allowed (or routed to the existing clinic-wide report).

- **Endpoint shape:** `GET /api/doctor/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month`
  → `{ buckets: [{ period_start, visits, collected }], totals: { visits, collected } }`.
  snake_case keys.

- **Definition of "money collected"** = sum of `payments.amount` where
  `payments.status = 'Paid'` for that doctor's completed bookings in the period. Waived
  / refunded excluded (confirm with the doctor whether refunds should net off).

- **Wire / inventory deltas:** add `v_doctor_period_summary` to §5 + a
  `VDoctorPeriodSummaryRow` DTO; add the summary read to §10 as doctor-scoped.

**Open question for the doctor:** does "collected" mean cash actually received
(`payments.status = 'Paid'`), or billed regardless of payment? Assumed *received*.

**Checklist:** §18 group **L**.

---

## 17. Open risks & not-yet-analyzed

> Surfaced during the review passes on 2026-09-09. **Not folded into §4–§13** because
> most are behaviour, not wire shape — but every one needs an owner + a decision during
> full coding. Ordered by bite radius. Checklist groups **I / J / K** in §18 below.

### 17.1 Broken today (fix regardless of the .NET swap)

| # | Issue | Detail |
|---|-------|--------|
| 1 | **`patient_code` collisions** | Generated client-side as `` `MF-${1000+random*9000}` `` (`registerPatientAccount.ts`, both walk-in pages). Only 9000 values, no retry; `patients.patient_code` is `unique` → inserts start failing at ~110 patients, routinely by ~1000. Needs a server/DB sequence (e.g. `MF-000001`). |
| 2 | **No slot double-booking guard** | No `unique (doctor_id, appointment_date, slot_start_time)` and no exclusion constraint on `bookings`. `slot_capacity` is enforced only in browser JS. Concurrent bookings for one slot both succeed. |
| 3 | **Timezone bug, app-wide** | `new Date().toISOString().slice(0,10)` computes "today" in **UTC**, not `Asia/Manila` (UTC+8). Midnight–08:00 PHT, dashboards / queue / walk-in all query **yesterday**. Fix on both FE and .NET (explicit tz). |
| 4 | **Public storage buckets** | `supabase/storage.sql` sets `public = true` + a `select` policy `to public` on `patient-documents` and `patient-lab-results`. Patient files sit at guessable, unauthenticated URLs. .NET should serve via authorized endpoints / signed URLs. |

### 17.2 Backend infrastructure the .NET swap must add (PostgREST/Supabase gave these for free)

| # | Issue | Detail |
|---|-------|--------|
| 5 | **Authorization matrix** | `supabase/rls.sql` (645 lines) *is* the authz model — waive = Doctor-only, refund = Admin-only, patient sees only own rows, staff see all, anon reads active doctors, etc. No inventory of these rules exists in this contract. Every .NET endpoint needs them re-implemented. **Highest-effort item.** |
| 6 | **Transactions** | `createDoctor` writes 5 tables; booking creation writes `bookings` + `booking_services` + `payments`; consultation save writes `consultations` + replace-all `consultation_diagnoses` + `follow_ups` (+ soon `lab_orders`, `medical_certificates`). Must be atomic — mark the units. |
| 7 | **Scheduled jobs** | Nothing sets `Expired` (unpaid `Pending` bookings live forever), nothing auto-sets `NoShow`, `follow_ups.reminder_enabled` reminders never fire. Needs a scheduler (pg_cron / .NET hosted service). |
| 8 | **Error-response contract** | PostgREST returns `{code, message, details, hint}`; the FE mostly checks `error` truthiness. Define a `.NET` error envelope or FE error handling breaks. |
| 9 | **Optimistic concurrency** | `updated_at` exists but nothing version-checks. Two staff editing one booking = silent lost update. Add `If-Unmodified-Since` / row-version checks on mutations. |
| 10 | **CORS / API versioning / observability** | All implicit today. .NET needs explicit CORS for the Next origin, an `/api/v1` story (a shape change breaks the deployed FE), and logging/metrics/error reporting (there is none). |
| 11 | **Config surface** | §1 lists 3 env vars. .NET adds DB connection string, JWT signing key, SMTP, storage creds, CORS origins, scheduler settings — none documented. |
| 12 | **Data migration & cutover** | Moving off Supabase = ETL of live rows, auth-user migration, storage-object migration, cutover window, rollback plan. Not written. |
| 13 | **JWT validation cost** | .NET must validate the token locally (signing key), not by calling out per request. |

### 17.3 Domain / compliance gaps

| # | Issue | Detail |
|---|-------|--------|
| 14 | **Audit logging near-absent** | `audit_logs` + a 7-entity enum exist, but the FE only writes it "on amend". No trail for booking create/cancel, payment confirm/waive/refund, patient edits, staff invite/revoke, settings changes. .NET should audit every mutation. |
| 15 | **Consultation immutability** | A `Completed` consultation can be `UPDATE`d directly — no trigger, no guard. Completed medical records should be append-only (that's what `Amended` + `audit_logs` are for). |
| 16 | **Booking status state machine** | 11 statuses, legal transitions written down nowhere; FE enforces ad hoc. .NET should own the machine and reject illegal transitions. |
| 17 | **Guest-patient dedup** | Walk-in quick-register makes a fresh `patients` row every time; same person next visit = duplicate + new `patient_code`. No match-on-name+DOB, no merge flow. |
| 18 | **Hard deletes on medical data** | `patients_delete_staff` hard-deletes. No soft-delete / retention policy; conflicts with medical-record retention law. |
| 19 | **PH Data Privacy Act (RA 10173)** | Consent capture exists (`consented_at`, `consent_version`, `/patient/privacy-consent`). Retention limits, right-to-erasure vs retention conflict, breach-notification process, patient data export (only admin CSV today) — not addressed. |
| 20 | **Controlled-substance workflow** | `prescription_line_items.is_controlled_substance` and `doctors.s2_number` exist but drive nothing — no extra logging, quantity limits, or S2-required guard. |
| 21 | **Reporting views at scale** | `v_doctor_ratings`, `v_daily_booking_summary` re-aggregate full tables on every read. Need materialized views / caching once data grows. |
| 22 | **Stub reference data** | 5 ICD-10 codes, 15 medicines seeded. Real clinic needs the full ICD-10-CM set + actual formulary; and admin CRUD for medicines/services if that is expected. |
| 23 | **`is_email_verified` vs auth `email_confirmed_at`** | Two sources of truth on `patients`; sync rule undefined. |

### Not yet deep-analyzed (implementation-phase work, flagged so it is not forgotten)

- The 1,100-line consultation page (`src/app/doctor/consultation/[bookingId]/page.tsx`) — full field/write inventory.
- `supabase/rls.sql` line-by-line (only grepped so far) → the §17.2 #5 authz matrix.
- Booking-wizard slot/availability math (`src/lib/bookingTime.ts`) → server port.
- Reviews, announcements, admin reports/exports — write paths and rules.
- Every server action's exact failure/rollback behaviour.

---

## 18. Full-coding checklist

Consolidated to-do for the real implementation pass. Nothing here is done yet.
Sections in parentheses point at the detail above.

### A. Contract fidelity (do not regress) — see §0, §3, §4, §6, §12

- [ ] JSON on the wire is **snake_case** everywhere (`[JsonPropertyName]` on every DTO prop, `PropertyNamingPolicy = null`).
- [ ] Enum strings byte-for-byte from §3 (`PayAtClinic`, `OnLeave`, `ProofSubmitted`, `NoShow`, …).
- [ ] Primary-key names unchanged (`patient_id`, `booking_id`, `staff_id`, `doctor_id`, `group_id`, `template_id`, …).
- [ ] To-one embeds return a **single object** (support object-or-1-element-array on read; see `src/lib/one.ts`); to-many return arrays. Embed strings per §6.
- [ ] Dates/times as ISO / Postgres-compatible strings.
- [ ] Server-action camelCase inputs (§9) untouched unless the TS callers change in the same PR.
- [ ] Smoke path still green: login → `profiles.role` → dashboard; create booking; staff payment update; doctor consultation save; patient profile load.

### B. Close the known gaps — see §15

- [ ] `icd10_codes` — add `Icd10CodeRow` DTO + endpoint; wire the diagnosis picker to it (FE stores `custom_description` only today).
- [ ] `lab_orders` — decide: implement persistence (DTO exists) or formally defer.
- [ ] `patient_vaccinations` — consultation **write** path (list pages already read it).
- [ ] Password-recovery completion page (`resetPasswordForEmail` currently dead-ends at `/login`).
- [ ] Auth callback route (`/auth/callback`) — currently missing.
- [ ] Fix stale `src/middleware.ts` references in this doc → `src/proxy.ts` (function `proxy`), §1 / §2 / §14.

### C. Amendment — staff vitals at intake — see §16.1

- [ ] Migration: `alter table patient_vital_readings add column recorded_by_user_id uuid references auth.users(id) on delete set null;`
- [ ] Add `recorded_by_user_id` to `PatientVitalReadingRow` (already stubbed) + `supabase-types.ts` + §4 (promote from PROPOSED).
- [ ] §10 *Clinical*: list **Staff** as a writer of `patient_vital_readings`.
- [ ] FE: vitals step in `staff/walk-in/**` or a panel on `staff/bookings/[id]/**`, reusing `VitalsEditor.tsx`.
- [ ] RLS already allows it (`patient_vital_readings_write_staff` = `is_staff_like()`) — verify, no change expected.

### D. Amendment — list pagination + search — see §16.2

- [ ] Every list endpoint: keyset/cursor pagination (`limit`, `cursor`), server `q` search, server `sort`.
- [ ] Response envelope `{ rows, next_cursor, total? }`; row objects keep §4/§6 shapes.
- [ ] Add indexes: `patients(last_name)` / trigram for name search; confirm `bookings(doctor_id, appointment_date)` covers the queue query.
- [ ] Update §10 + §13 to show the paged envelope for affected resources.
- [ ] FE: `doctor/patients` card grid → `DataTable`; all list pages stop fetching-all + filtering in memory.

### E. Amendment — walk-in intake + FCFS queue + fee schedule + real clinic identity — see §16.3, §16.6, §16.8

- [ ] **Clinic identity:** update seed + app title — "Grace Medical Clinic", doctor "ALLYN GRACE T. ESPAÑA-GAVINO, MD", address "3ML Quezon National Highway, Buaya, Lapu-Lapu City", contact `09285612976`; seed `doctors.license_number = 0125232` (PTR per-year, editable). Store credentials line(s) ("Family and Community Medicine" / "Adult and Pedia").
- [ ] **⚠ Split-shift hours:** rework `clinic_operating_hours` + `doctor_schedules` to allow ≥ 2 sessions per day (Mon–Fri 10–17 **and** 19–20). Drop `unique (doctor_id, day_of_week)`; update the `doctor,day_of_week` upsert and `src/lib/bookingTime.ts` slot math. → §4/§10/WireModels/supabase-types.
- [ ] Server-assigned FCFS position on `POST /api/bookings` — integer per (doctor, `appointment_date`), race-safe in the create transaction; FE stops computing `queue_number`. Never sort by the display string.
- [ ] Define + enforce the walk-in booking status flow server-side (`Pending → CheckedIn → InProgress → Completed`, `Cancelled`/`NoShow` terminal); reject illegal transitions at the API.
- [ ] Decide `slot_start_time`/`slot_end_time` for walk-ins (arrival timestamp vs nullable).
- [ ] Create-booking response includes the doctor + patient nests for the ticket projection (position/`queue_number`, patient name/`patient_code`, doctor `full_name`, `appointment_date`, `clinic_name`/`logo_url`).
- [ ] **Booking tag:** add `bookings.visit_type` (`New` | `FollowUp`) — **doctor-set at consultation**, not staff at creation (§16.3 step 7) → §3/§4/WireModels/supabase-types.
- [ ] **Fee timing:** fee is provisional at booking creation; recompute `total_fee`/`amount_due`/`payments.amount` on consultation-complete and on any later `visit_type`/`booking_services` edit — never at booking creation (§16.6 "Fee timing"). Staff "collect money" confirms against the finalised amount.
- [ ] **Senior/PWD:** add `patients.pwd_id_number` / `patients.senior_id_number` + per-booking `bookings.discount_category` (`None`|`Senior`|`PWD`) and `bookings.discount_amount` snapshot.
- [ ] **Fee schedule storage:** `clinic_settings` — `fee_consultation` 450, `fee_follow_up` 350, `fee_med_cert` 50, `discount_pct` 0.20 — not hard-coded. (No flat senior rate; discount is a % of total per the parked assumption.)
- [ ] **Med-cert +50:** seed a `services` row (`Medical Certificate`, 50) and add it to `booking_services` when the doctor issues the cert.
- [ ] **Server-side fee computation:** `gross = base(visit_type) + Σ booking_services`; `discount_amount = discount_pct * gross` when category ≠ None; `total_fee = gross − discount_amount`; `amount_due = total_fee − confirmed payments`. `consultation_fee_snapshot` = billed base.
- [ ] Pricing questions in §16.6 are **PARKED** — owner to decide (stacking, whether −20% hits the med-cert line, per-doctor vs flat, who can edit post-payment). Build the tag + `discount_category` + `discount_pct` config now so the rule is a one-line change later.
- [ ] FE: intake flow (search → match/register → booking + follow-up tag + discount → vitals → queue) as one staff sequence.
- [ ] FE: queue-ticket print — HTML + `window.print()` (as `src/lib/print.ts`); WebUSB/Web-Serial ESC/POS only if thermal-direct is required.

### F. Performance — see §16.4

- [ ] One purpose-built endpoint per screen (single server-to-server call, §4/§6 shapes).
- [ ] Single session endpoint/RPC → `{ user_id, role, staff_id, patient_id, display_name, avatar_url }` in one round-trip.
- [ ] .NET validates JWT locally (signing key), no network round-trip per request.
- [ ] Cache headers (ETag / `Cache-Control`) on reference data: `services`, `vital_field_templates`, `clinic_settings`, `clinic_operating_hours`, `clinic_accepted_payment_methods`, `icd10_codes`, `medicines`, active-doctor lists.
- [ ] Endpoints return narrow projections, not `select("*")`; drop unrendered embed branches.
- [ ] FE: async Server Components as the default for data pages; `"use client"` only at interactive leaves.
- [ ] FE: resolve session in a server layout, not a client `useEffect`.
- [ ] FE: shrink / lazy-load FontAwesome (`@fortawesome/fontawesome-svg-core` + 3 packs).
- [ ] FE: `revalidate` on reference-data reads.
- [ ] Benchmark against a **prod build** (`next build && next start`), not `next dev`.

### G. Auth & storage — see §7, §8

- [ ] Keep Supabase Auth **or** issue JWTs that still expose `user.id` the way `SessionProvider` / `proxy.ts` read it.
- [ ] Storage: keep the two buckets (`patient-documents`, `patient-lab-results`), 10 MB cap, path `{patientId}/{bookingId}/{timestamp}-{sanitizedFileName}`, or return the same public-URL shape in `file_url`.
- [ ] Preserve allowed MIME set (`src/lib/patientUploads.ts`): pdf, jpeg, png, webp, gif, msword, docx.

### H. Responsive, accessibility & non-technical usability — see §16.5

- [ ] Convert hand-rolled `<table>` on `doctor/patients/[id]`, `doctor/dashboard`, `admin/calendar`, `admin/reports`, `staff/dashboard`, `patient/doctors/[id]` to `DataTable` with `renderMobileCard` (or at minimum wrap every one in `overflow-x-auto`; `patient/vaccinations` is missing it).
- [ ] Bump icon-button / pagination / row hit areas to ≥ 44×44px.
- [ ] Real-device QA matrix: small phone (~360px), large phone, iPad portrait + landscape, laptop, ≥ 1920px monitor.
- [ ] Decide wide-screen behaviour ≥ `xl` (multi-column dashboards, or accept the 1440px cap deliberately).
- [ ] Raise base body text (16px) or add a user-facing text-size / zoom control; retire 11px `label-sm` for anything a user must read.
- [ ] Visible text labels (not just `aria-label`) on the notification, menu, and pagination controls.
- [ ] `<label>` (or `aria-label`) on every input/select — currently ~46 labels for ~173 controls; kill placeholder-only fields.
- [ ] First-run onboarding / inline help / tooltips for the doctor + staff dashboards.
- [ ] Accessibility pass: visible focus rings, full keyboard nav, one screen-reader run per role, colour-contrast check on `StatusPill` variants.
- [ ] Pair with §F — the perceived-speed fixes are half of "feels usable" for non-technical staff.

### I. Printable clinical documents — match the real paper forms — see §16.7, §16.8

- [ ] **Prescription line items** — add structured columns to `prescription_line_items`: `timing` (Breakfast/Lunch/Dinner/Bedtime), `meal_relation` (Before/After), `duration_kind` (Maintain/Days/Weeks) + `duration_value`, `indication`. Keep `generic_name`/`dosage`. → §3/§4/WireModels/supabase-types.
- [ ] "Next appointment" on the Rx pad → reuse `follow_ups` or add `prescription_groups.next_appointment_date`.
- [ ] **New table `medical_certificates`** with the §16.8 columns (issue_date, patient_address_snapshot, examined_at, examination_date_from/to, diagnosis_text, recommendations, purpose_exception, come_back_on, issued_by_user_id; FKs to consultations/patients/doctors) + `MedicalCertificateRow` DTO + §4 + supabase-types. (Supersedes the §16.7 draft columns.)
- [ ] **New table `lab_test_catalog`** (name, is_default, sort_order) seeded with the 9 pre-printed tests + TSH/FT3/FT4/HbA1c; add `lab_orders.lab_test_id` (nullable FK) beside free-text `test_name`. Decide whether to add `lab_order_groups` (one printed sheet = one unit).
- [ ] Persist `lab_orders` on consultation save (table exists; FE holds it local-only today). Move from §15 gap → §10 write path.
- [ ] Issuing a med-cert inserts the `services` "Medical Certificate" (₱50) row into `booking_services` → fee recompute (§16.6).
- [ ] One shared print-letterhead block (clinic name/address/contact/hours/logo from `clinic_settings` + doctor name/credentials/`license_number`/`ptr_number` from `doctors`); reuse `src/lib/print.ts` `printHtml()` for all three documents; match the §16.8 layout.

### J. Broken-today fixes — see §17.1

- [ ] `patient_code` — server/DB sequence, drop the client-side `Math.random()` (`registerPatientAccount.ts`, both walk-in pages).
- [ ] `bookings` — add `unique (doctor_id, appointment_date, slot_start_time)` or an exclusion constraint; enforce `slot_capacity` server-side.
- [ ] Timezone — compute "today" / date ranges in `Asia/Manila` on both FE and .NET; stop using `new Date().toISOString().slice(0,10)`.
- [ ] Storage — make buckets private; serve patient files via authorized endpoints / signed URLs, not `getPublicUrl`.

### K. Backend infra + domain/compliance — see §17.2, §17.3

- [ ] **Authorization matrix** — port every `supabase/rls.sql` rule to endpoint authz (waive=Doctor, refund=Admin, patient=own rows, staff=all, anon=active doctors, …).
- [ ] Wrap multi-table writes in transactions (`createDoctor`, booking create, consultation save).
- [ ] Scheduler: expire stale `Pending` bookings, auto-`NoShow`, fire `follow_ups` reminders.
- [ ] Define the error-response envelope; define + enforce the booking status state machine.
- [ ] Optimistic concurrency (row-version / `If-Unmodified-Since`) on mutations.
- [ ] CORS for the Next origin; `/api/v1` versioning; logging / metrics / error reporting.
- [ ] Document the full env/config surface; write the data-migration + cutover + rollback plan.
- [ ] Audit-log every mutation (not just consultation amend).
- [ ] Consultation immutability guard once `Completed` (force the amend path).
- [ ] Guest-patient dedup / merge flow (match on name + DOB).
- [ ] Soft-delete + retention policy for medical data (no hard deletes).
- [ ] PH Data Privacy Act: retention limits, right-to-erasure handling, breach process, patient data export.
- [ ] Controlled-substance workflow (`is_controlled_substance` / `s2_number` currently inert).
- [ ] Materialize / cache `v_doctor_ratings`, `v_daily_booking_summary` at scale.
- [ ] Load full ICD-10-CM + real formulary; admin CRUD for medicines / services.
- [ ] Define `is_email_verified` ↔ auth `email_confirmed_at` sync rule.

### L. Doctor earnings / visits dashboard — see §16.9

- [ ] New view `v_doctor_period_summary` (one row per `doctor_id` + `appointment_date`: `visits`, `collected`) + `VDoctorPeriodSummaryRow` DTO → §5.
- [ ] Endpoint `GET /api/doctor/summary?from=&to=&granularity=day|week|month` → `{ buckets:[{period_start,visits,collected}], totals:{visits,collected} }`, snake_case.
- [ ] **Doctor-only + own rows:** `security_invoker` on the view (or predicate); .NET filters `doctor_id = current_doctor_id()`, Staff → 403, Admin → clinic-wide report.
- [ ] "Collected" = Σ `payments.amount` where `status = 'Paid'` for that doctor's `Completed` bookings in range. Confirm refund netting with the doctor.
- [ ] FE: period switcher (daily / weekly / monthly) + two figures (visits, collected) on the doctor dashboard.

---

**Bottom line for .NET:** keep every JSON key and enum string in this document **byte-for-byte**. Rename only inside C# classes if you must — never on the wire the browser consumes.
