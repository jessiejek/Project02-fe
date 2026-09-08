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

| Variable | Client-visible? | Used by |
|----------|-----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `src/lib/supabase/client.ts`, `server.ts`, `admin.ts`, `middleware.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | browser + server anon clients, middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** (server only) | `src/lib/supabase/admin.ts`, invite/register/createDoctor actions |

No other `process.env.*` in app source.

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

**Bottom line for .NET:** keep every JSON key and enum string in this document **byte-for-byte**. Rename only inside C# classes if you must — never on the wire the browser consumes.
