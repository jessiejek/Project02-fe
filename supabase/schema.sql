-- =============================================================================
-- Dr. Grace Gavino Medical Clinic — Supabase (PostgreSQL) schema
--
-- Design-phase deliverable. Derived entirely from patient.md / staff.md /
-- doctor.md / admin.md (the frontend's own "as-built reference" docs) and
-- clinic-app/src/data/types.ts — NOT from any legacy schema or backend.
-- See ../Database-Schema-Design.md for the full narrative + reasoning behind
-- every judgment call referenced in the comments below.
--
-- Explicitly NOT included here: Supabase project/CLI setup or storage bucket
-- config (see storage.sql). RLS policies live in rls.sql (remaining.md B.1).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- ENUM TYPES
-- Every value below is quoted verbatim from clinic-app/src/data/types.ts so a
-- future Supabase-backed frontend swap needs no value remapping.
-- -----------------------------------------------------------------------------

create type user_role as enum ('Patient', 'Staff', 'Doctor', 'Admin');
create type staff_role as enum ('Staff', 'Doctor', 'Admin');
-- 'OnLeave' added: DoctorForm.tsx's status dropdown already offered it with
-- no enum value to land in — found and fixed during the decorative-input
-- mapping sweep (see Database-Schema-Design.md's frontend-gaps list).
create type staff_status as enum ('Active', 'Inactive', 'Invited', 'OnLeave');
create type sex_type as enum ('Male', 'Female');
create type doctor_day_status as enum ('Available', 'RunningLate', 'UnavailableToday');
create type service_category as enum ('Consultation', 'Procedure', 'Laboratory', 'Diagnostic');

create type booking_status as enum (
  'Pending', 'ProofSubmitted', 'Confirmed', 'CheckedIn', 'InProgress',
  'OnHold', 'Cancelled', 'Completed', 'Expired', 'NoShow', 'Rescheduled'
);
create type payment_mode as enum ('Online', 'PayAtClinic');
create type payment_status as enum ('Unpaid', 'Paid', 'Waived', 'Refunded');
create type payment_method as enum ('Cash', 'GCash', 'Maya', 'BankTransfer');
create type proof_type as enum ('ReferenceNumber', 'Screenshot');

-- doctor.md flags an unresolved conflict between "Draft/Completed/Amended"
-- and "Draft/Completed/Locked/Amended" — resolved by dropping `Locked`:
-- amend mode never changes booking status and is fully tracked in
-- audit_logs, so a fourth lock state would just duplicate that trail.
create type consultation_status as enum ('Draft', 'Completed', 'Amended');

-- Adopts patient.md's superset over doctor.md's narrower Primary/Secondary
-- list (documented resolution already recorded in types.ts): a superset can
-- always represent the narrower set, never the reverse.
create type diagnosis_type as enum ('Primary', 'Secondary', 'Differential', 'Comorbidity');

-- Added after a UX review of the consultation page: retyping "normal"
-- findings by hand on every visit was flagged as the single biggest source
-- of documentation friction. Backs soap_phrases below.
create type soap_field as enum ('ChiefComplaint', 'Subjective', 'Objective', 'Assessment', 'Plan');

create type lab_order_status as enum ('Requested', 'Completed');
create type vaccination_status as enum ('Administered', 'Scheduled', 'Overdue');
create type vaccination_source as enum ('AdministeredInClinic', 'PatientReported', 'ExternalRecord');
create type audit_entity_type as enum ('Booking', 'Patient', 'Doctor', 'Payment', 'Settings', 'Consultation', 'Staff');

-- admin.md §13's "Pending Follow-Ups" report explicitly lists a `status`
-- column, which is why follow-ups get their own table (below) rather than
-- flat columns on consultations, unlike vitals.
create type follow_up_status as enum ('Pending', 'Completed');

-- -----------------------------------------------------------------------------
-- SHARED TRIGGER: keep updated_at current on every mutable table
-- -----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- A. IDENTITY
-- =============================================================================

-- Thin dispatch table over Supabase Auth — just enough to answer "what role
-- is this authenticated user" for RLS policies, without duplicating anything
-- auth.users already tracks (email, email_confirmed_at, etc.).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  created_at timestamptz not null default now()
);

-- Patients have their OWN primary key, not auth.users.id, because a patient
-- can exist without ever logging in (staff/admin walk-in quick-register) —
-- user_id is nullable+unique, populated only once a portal account exists.
create table patients (
  patient_id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  patient_code text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date not null,
  sex sex_type not null,
  civil_status text,
  address text,
  city text,
  zip_code text,
  contact_number text,
  email text not null,
  emergency_contact_name text,
  emergency_contact_number text,
  emergency_contact_relationship text,
  blood_type text,
  philhealth_number text,
  hmo_provider text,
  hmo_card_number text,
  -- staff.md's PatientSummary documents isGuest directly; NoAccount (guest,
  -- deliberately no login) vs AccountUnknown (no login, not flagged as a
  -- guest — ambiguous/incomplete data) are both just user_id IS NULL, told
  -- apart by this flag, rather than a separate stored "account status" enum
  -- that would just be a derived/redundant read of the same two columns.
  is_guest boolean not null default false,
  is_email_verified boolean not null default false,
  consented_at timestamptz,
  consent_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_patients_user_id on patients(user_id);
create index idx_patients_patient_code on patients(patient_code);
create trigger trg_patients_updated_at before update on patients
  for each row execute function set_updated_at();

-- Covers Staff, Doctor, and Admin — admin.md's own Staff Management screen
-- lists all three under one "role" column, confirming they're one entity,
-- not three. user_id is NOT NULL because Supabase's invite-by-email flow
-- provisions the auth.users row immediately (status starts 'Invited').
create table staff_accounts (
  staff_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  contact_number text,
  role staff_role not null,
  status staff_status not null default 'Invited',
  avatar_url text,
  invited_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_staff_accounts_user_id on staff_accounts(user_id);
create index idx_staff_accounts_role on staff_accounts(role);
create trigger trg_staff_accounts_updated_at before update on staff_accounts
  for each row execute function set_updated_at();

-- 1:1 extension of staff_accounts, only for role = 'Doctor'. rating/
-- reviewCount from doctor.md are deliberately NOT stored here — see
-- v_doctor_ratings — to avoid a derived value going stale.
create table doctors (
  doctor_id uuid primary key references staff_accounts(staff_id) on delete cascade,
  specialization text not null,
  consultation_fee numeric(10, 2) not null default 0 check (consultation_fee >= 0),
  bio text,
  license_number text,
  ptr_number text,
  s2_number text,
  slot_duration_minutes integer not null default 30 check (slot_duration_minutes > 0),
  slot_capacity integer not null default 1 check (slot_capacity > 0),
  daily_patient_limit integer check (daily_patient_limit is null or daily_patient_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_doctors_updated_at before update on doctors
  for each row execute function set_updated_at();

-- Postgres CHECK constraints can't reference other tables, so this data-
-- integrity rule (a doctors row must point at a staff_accounts row whose
-- role is actually 'Doctor') is enforced with a trigger instead.
create or replace function check_doctor_role()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from staff_accounts where staff_id = new.doctor_id and role = 'Doctor'
  ) then
    raise exception 'doctors.doctor_id must reference a staff_accounts row with role = Doctor';
  end if;
  return new;
end;
$$;
create trigger trg_doctors_check_role before insert or update on doctors
  for each row execute function check_doctor_role();

-- =============================================================================
-- B. DOCTOR SCHEDULING
-- =============================================================================

create table doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  is_active boolean not null default true,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, day_of_week),
  check (not is_active or end_time > start_time)
);
create index idx_doctor_schedules_doctor_id on doctor_schedules(doctor_id);
create trigger trg_doctor_schedules_updated_at before update on doctor_schedules
  for each row execute function set_updated_at();

-- Blocked dates override the weekly schedule entirely (doctor.md §7).
create table doctor_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  blocked_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (doctor_id, blocked_date)
);
create index idx_doctor_blocked_dates_doctor_id on doctor_blocked_dates(doctor_id);

-- One row per (doctor, date) — "applies to today only" per staff.md §8.
create table doctor_day_statuses (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  status_date date not null,
  status doctor_day_status not null default 'Available',
  running_late_minutes integer check (running_late_minutes is null or running_late_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, status_date)
);
create index idx_doctor_day_statuses_doctor_id on doctor_day_statuses(doctor_id);
create trigger trg_doctor_day_statuses_updated_at before update on doctor_day_statuses
  for each row execute function set_updated_at();

-- =============================================================================
-- C. SERVICES CATALOG
-- =============================================================================

-- Clinic-wide catalog (admin.md §7): name/category/price live here.
create table services (
  service_id uuid primary key default gen_random_uuid(),
  name text not null,
  category service_category not null,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_services_updated_at before update on services
  for each row execute function set_updated_at();

-- Many-to-many doctor<->service assignment. duration_minutes lives on the
-- JUNCTION, not on `services`, because patient.md's patient-facing
-- DoctorService includes a duration that can differ per doctor, while
-- admin.md's catalog itself has no duration field — this reconciles both.
create table doctor_services (
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  service_id uuid not null references services(service_id) on delete cascade,
  duration_minutes integer not null check (duration_minutes > 0),
  created_at timestamptz not null default now(),
  primary key (doctor_id, service_id)
);
create index idx_doctor_services_service_id on doctor_services(service_id);

-- =============================================================================
-- D. BOOKINGS & PAYMENTS
-- =============================================================================

-- No payment_status column here — patient.md itself flags this as an open
-- item ("confirm payments stays a separate table, keeps booking row small")
-- resolved here: payment state lives ONLY on `payments`, never duplicated.
create table bookings (
  booking_id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(patient_id) on delete restrict,
  doctor_id uuid not null references doctors(doctor_id) on delete restrict,
  appointment_date date not null,
  slot_start_time time not null,
  slot_end_time time not null,
  status booking_status not null default 'Pending',
  payment_mode payment_mode not null,
  queue_number text,
  -- patient.md's Booking fields include consultationFeeSnapshot AND
  -- serviceFeeSnapshot as distinct values: the doctor's base consultation
  -- fee is charged on every booking regardless of which additional services
  -- (in booking_services) are selected, so it's snapshotted separately here
  -- rather than folded into the services total. total_fee = this + sum of
  -- booking_services.price_at_booking.
  consultation_fee_snapshot numeric(10, 2) not null default 0 check (consultation_fee_snapshot >= 0),
  total_fee numeric(10, 2) not null default 0 check (total_fee >= 0),
  amount_due numeric(10, 2) not null default 0 check (amount_due >= 0),
  is_walk_in boolean not null default false,
  proof_type proof_type,
  proof_value text,
  proof_submitted_at timestamptz,
  cancelled_by_user_id uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slot_end_time > slot_start_time)
);
create index idx_bookings_patient_id on bookings(patient_id);
create index idx_bookings_doctor_id on bookings(doctor_id);
create index idx_bookings_doctor_date on bookings(doctor_id, appointment_date);
create index idx_bookings_status on bookings(status);
create trigger trg_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

-- A booking can carry multiple services (patient.md §5 step 1: multi-select).
-- price_at_booking is a deliberate snapshot — services can reprice later —
-- so historical receipts stay accurate; not a denormalization shortcut.
create table booking_services (
  booking_id uuid not null references bookings(booking_id) on delete cascade,
  service_id uuid not null references services(service_id) on delete restrict,
  price_at_booking numeric(10, 2) not null check (price_at_booking >= 0),
  primary key (booking_id, service_id)
);
create index idx_booking_services_service_id on booking_services(service_id);

-- 1:1 with bookings. Also absorbs patient.md's Booking.isProfessionalFeeWaived
-- / professionalFeeWaivedReason, which duplicated payments.status='Waived' —
-- dropped from bookings entirely per the no-duplicated-data requirement.
create table payments (
  payment_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(booking_id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  status payment_status not null default 'Unpaid',
  payment_method payment_method,
  reference_number text,
  or_number text unique,
  -- staff.md §3's Confirm Payment modal is explicit in its API payload —
  -- `{ paymentMethod, amountReceived, referenceNumber?, notes? }` — and its
  -- own UI text ("Amount Received... must be >= amount due, overpayment
  -- allowed") requires a value that can legitimately exceed `amount`, so it
  -- can't just reuse that column.
  amount_received numeric(10, 2) check (amount_received is null or amount_received >= 0),
  confirm_notes text,
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  -- admin.md's resolved finding: waive is Doctor-only, refund is Admin-only —
  -- enforced later via RLS, not by this table's structure.
  waived_by_user_id uuid references auth.users(id) on delete set null,
  waived_reason text,
  waived_at timestamptz,
  refunded_by_user_id uuid references auth.users(id) on delete set null,
  -- admin.md's Refund modal collects an amount alongside the reason — kept
  -- distinct from `amount` since a refund can be partial.
  refund_amount numeric(10, 2) check (refund_amount is null or refund_amount >= 0),
  refund_reason text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payments_booking_id on payments(booking_id);
create index idx_payments_status on payments(status);
create trigger trg_payments_updated_at before update on payments
  for each row execute function set_updated_at();

-- One row per booking (a booking has exactly one doctor, so this also
-- satisfies patient.md's "one review per booking/doctor pair" rule for free).
create table reviews (
  review_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(booking_id) on delete cascade,
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  patient_id uuid not null references patients(patient_id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index idx_reviews_doctor_id on reviews(doctor_id);
create index idx_reviews_patient_id on reviews(patient_id);

-- =============================================================================
-- E. CLINICAL RECORDS
-- =============================================================================

-- 1:1 with bookings. Vitals used to be flat columns here (a genuine 1:1
-- attribute set) but that shape was retired when the frontend adopted
-- clinic-vitals-fe.md's template-driven model: a doctor can add arbitrary
-- custom vitals via the "Others" picker at runtime, which a fixed set of
-- columns can't represent. See vital_field_templates / patient_vital_readings
-- below instead.
create table consultations (
  consultation_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(booking_id) on delete cascade,
  patient_id uuid not null references patients(patient_id) on delete restrict,
  doctor_id uuid not null references doctors(doctor_id) on delete restrict,
  status consultation_status not null default 'Draft',
  chief_complaint text,
  subjective text,
  objective text,
  assessment text,
  plan text,
  -- "Doctor Notes" is shown as its own field, separate from the SOAP summary,
  -- in doctor.md §3's Appointment Overview and patient.md §10's medical
  -- records view (`doctorNotes`/`generalNotes` in their data-model lists).
  doctor_notes text,
  completed_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_consultations_patient_id on consultations(patient_id);
create index idx_consultations_doctor_id on consultations(doctor_id);
create trigger trg_consultations_updated_at before update on consultations
  for each row execute function set_updated_at();

-- Vitals are template-driven, not a fixed set of columns — a doctor can add
-- arbitrary custom vitals via the "Others" modal in the UI, which flat
-- columns can't represent. vital_field_templates is the small, mostly-static
-- catalog (the 7 defaults, `is_default = true`, plus any custom ones a
-- doctor has used); patient_vital_readings is one row per (booking,
-- template) — a booking with no rows yet shows every default template as
-- empty in the UI, and saved rows pre-fill them.
create table vital_field_templates (
  template_id uuid primary key default gen_random_uuid(),
  description text not null,
  form_key text not null unique,
  -- '' for custom (non-default) vitals, which have no fixed unit of measure.
  unit text not null default '',
  icon text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- No BMI column: the reference model this replaced clinic-vitals-fe.md's
-- shape stores blood pressure as ONE combined free-text value (e.g.
-- "128/82"), not separate systolic/diastolic numbers, and has no derived
-- fields at all — every value here is exactly what the doctor typed.
create table patient_vital_readings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(booking_id) on delete cascade,
  patient_id uuid not null references patients(patient_id) on delete restrict,
  template_id uuid not null references vital_field_templates(template_id) on delete restrict,
  value text not null,
  recorded_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, template_id)
);
create index idx_patient_vital_readings_booking_id on patient_vital_readings(booking_id);
create index idx_patient_vital_readings_patient_id on patient_vital_readings(patient_id);
create trigger trg_patient_vital_readings_updated_at before update on patient_vital_readings
  for each row execute function set_updated_at();

-- doctor.md lists FollowUp as its own entity (id, consultationId, patientId,
-- doctorId, ...), and admin.md §13's "Pending Follow-Ups" report explicitly
-- tracks a follow-up `status` — this is why it's a real table rather than
-- flat columns on `consultations` (unlike vitals, which have no status/
-- lifecycle of their own). patient_id/doctor_id are duplicated here for the
-- same RLS-performance reason as prescription_groups/lab_orders.
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references consultations(consultation_id) on delete cascade,
  patient_id uuid not null references patients(patient_id) on delete restrict,
  doctor_id uuid not null references doctors(doctor_id) on delete restrict,
  follow_up_date date not null,
  reason text,
  instructions text,
  reminder_enabled boolean not null default true,
  status follow_up_status not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_follow_ups_patient_id on follow_ups(patient_id);
create index idx_follow_ups_doctor_id on follow_ups(doctor_id);
create index idx_follow_ups_date on follow_ups(follow_up_date);
create trigger trg_follow_ups_updated_at before update on follow_ups
  for each row execute function set_updated_at();

-- Reference/lookup table — resolves doctor.md's own flagged open item
-- ("need an icd10_codes table either way"). Seeded with a small starter set
-- below; a real deployment bulk-loads the full WHO/CDC ICD-10-CM release.
create table icd10_codes (
  code text primary key,
  description text not null
);

-- A diagnosis is either a coded ICD-10 pick or a free-text description (or
-- both) — never neither.
create table consultation_diagnoses (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations(consultation_id) on delete cascade,
  icd10_code text references icd10_codes(code) on delete set null,
  custom_description text,
  type diagnosis_type not null default 'Primary',
  created_at timestamptz not null default now(),
  check (icd10_code is not null or custom_description is not null)
);
create index idx_consultation_diagnoses_consultation_id on consultation_diagnoses(consultation_id);
-- Enforces "mark one Primary" (doctor.md §4.3) at the database level.
create unique index idx_one_primary_diagnosis_per_consultation
  on consultation_diagnoses(consultation_id)
  where type = 'Primary';

-- SOAP speed tooling — mirrors the exact Favorites/Templates split already
-- established by doctor_favorite_medicines/prescription_templates: a
-- "phrase" is a single-field quick-insert shortcut (this table), a
-- "template" is a full multi-field bundle (the next table).
create table soap_phrases (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  field soap_field not null,
  label text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_soap_phrases_doctor_id on soap_phrases(doctor_id);
create trigger trg_soap_phrases_updated_at before update on soap_phrases
  for each row execute function set_updated_at();

-- One row covers all 5 SOAP fields — a genuine 1:1 attribute set with no
-- repetition, exactly like consultations' own chief_complaint/subjective/
-- objective/assessment/plan flat columns (see that table's own comment on
-- why flat columns are correct normalization there, not a shortcut) — so
-- this stays a single flat record rather than a header+items pair the way
-- prescription_templates/prescription_template_items are split.
-- is_system_template mirrors prescription_templates' same concept: a
-- clinic-wide default (e.g. "Annual Physical — Normal") every doctor can
-- use, hides edit/delete in the UI.
create table soap_templates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  title text not null,
  is_system_template boolean not null default false,
  chief_complaint text,
  subjective text,
  objective text,
  assessment text,
  plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_soap_templates_doctor_id on soap_templates(doctor_id);
create trigger trg_soap_templates_updated_at before update on soap_templates
  for each row execute function set_updated_at();

-- Rebuilt per clinic-prescriptions-fe.md: replaces the old prescriptions/
-- prescription_items pair (medicine_name/dosage_form/strength/dose/
-- frequency/duration/route/sig as separate fields, integer quantity) with
-- the frontend's simpler PrescriptionGroup/PrescriptionLineItem model —
-- a single free-text generic_name + dosage + instruction, plus real
-- Favorites/Templates tables (previously nonexistent in this schema).

-- Medicine search/autocomplete catalog (the "New Prescription" tab). Global,
-- not per-doctor.
create table medicines (
  medicine_id uuid primary key default gen_random_uuid(),
  generic_name text not null unique,
  created_at timestamptz not null default now()
);

-- One row per visit. A booking is only 1:1 with a group in the consultation-
-- embedded flow's own logic (it edits the existing group in place once one
-- exists) — the separate patient-chart create/copy page doesn't itself check
-- for an existing group before inserting, so booking_id is intentionally a
-- plain indexed FK here, not `unique`, matching actual application behavior
-- rather than a stricter rule the frontend doesn't itself enforce.
create table prescription_groups (
  group_id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(patient_id) on delete restrict,
  doctor_id uuid not null references doctors(doctor_id) on delete restrict,
  booking_id uuid not null references bookings(booking_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_prescription_groups_patient_id on prescription_groups(patient_id);
create index idx_prescription_groups_doctor_id on prescription_groups(doctor_id);
create index idx_prescription_groups_booking_id on prescription_groups(booking_id);
create trigger trg_prescription_groups_updated_at before update on prescription_groups
  for each row execute function set_updated_at();

-- generic_name/dosage/quantity/instruction are denormalized off medicine_id,
-- matching PrescriptionLineItem in types.ts (which already carries its own
-- genericName rather than always deriving it via join) — a doctor can freely
-- retype the name on this specific line (Edit Prescription modal) without
-- renaming the shared medicines catalog entry. quantity is free text (e.g.
-- "50pcs", "1 box"), not a strict count, per the frontend's own field.
create table prescription_line_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references prescription_groups(group_id) on delete cascade,
  medicine_id uuid not null references medicines(medicine_id) on delete restrict,
  generic_name text not null,
  dosage text not null,
  quantity text not null,
  instruction text,
  is_controlled_substance boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_prescription_line_items_group_id on prescription_line_items(group_id);
create index idx_prescription_line_items_medicine_id on prescription_line_items(medicine_id);

-- Single-medicine reuse shortcut — distinct from prescription_templates,
-- which is a full reusable multi-medicine set (clinic-prescriptions-fe.md
-- §3's "Add to Favorites vs Add to Template" distinction). Same denormalized
-- shape as prescription_line_items, for the same reason.
create table doctor_favorite_medicines (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  medicine_id uuid not null references medicines(medicine_id) on delete restrict,
  generic_name text not null,
  dosage text not null,
  quantity text not null,
  instruction text,
  created_at timestamptz not null default now()
);
create index idx_doctor_favorite_medicines_doctor_id on doctor_favorite_medicines(doctor_id);

-- A full reusable multi-medicine set. is_system_template rows (e.g. "Medical
-- Certificate") hide edit/delete in the UI — enforced at the application
-- layer, not the schema, same as every other UI-only permission in this
-- design.
create table prescription_templates (
  template_id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(doctor_id) on delete cascade,
  title text not null,
  is_system_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_prescription_templates_doctor_id on prescription_templates(doctor_id);
create trigger trg_prescription_templates_updated_at before update on prescription_templates
  for each row execute function set_updated_at();

create table prescription_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references prescription_templates(template_id) on delete cascade,
  medicine_id uuid not null references medicines(medicine_id) on delete restrict,
  generic_name text not null,
  dosage text not null,
  quantity text not null,
  instruction text,
  is_controlled_substance boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_prescription_template_items_template_id on prescription_template_items(template_id);

create table lab_orders (
  lab_order_id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations(consultation_id) on delete cascade,
  patient_id uuid not null references patients(patient_id) on delete restrict,
  doctor_id uuid not null references doctors(doctor_id) on delete restrict,
  test_name text not null,
  test_code text,
  reason text,
  clinical_indication text,
  specimen_type text,
  notes text,
  status lab_order_status not null default 'Requested',
  requested_at timestamptz not null default now(),
  result_attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_lab_orders_consultation_id on lab_orders(consultation_id);
create index idx_lab_orders_patient_id on lab_orders(patient_id);
create trigger trg_lab_orders_updated_at before update on lab_orders
  for each row execute function set_updated_at();

-- Single canonical vaccination-history table — merges what would otherwise
-- be two near-duplicate tables (one for "given during this consultation",
-- one for "patient's overall history"). consultation_id is nullable because
-- patient-reported/external-record entries (patient.md §12 `source`) have
-- no clinic consultation behind them at all.
--
-- route/site/expiry_date were added during a later mapping-completeness
-- pass: the consultation page's "Stage Vaccination" form collects Route,
-- Site, and an Expiry date (the vaccine vial's own expiry, distinct from
-- next_dose_date, which is the follow-up dose's scheduling date) alongside
-- vaccine name/dose/lot/manufacturer — real, wired fields (ConsultationVaccinationEntry
-- in types.ts) this table had no columns for at all until this pass.
create table patient_vaccinations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(patient_id) on delete cascade,
  consultation_id uuid references consultations(consultation_id) on delete set null,
  vaccine_name text not null,
  manufacturer text,
  dose_number smallint check (dose_number is null or dose_number > 0),
  route text,
  site text,
  lot_number text,
  expiry_date date,
  administered_date date,
  administered_by uuid references staff_accounts(staff_id) on delete set null,
  next_dose_date date,
  status vaccination_status not null default 'Scheduled',
  source vaccination_source not null default 'AdministeredInClinic',
  notes text,
  reaction_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_patient_vaccinations_patient_id on patient_vaccinations(patient_id);
create trigger trg_patient_vaccinations_updated_at before update on patient_vaccinations
  for each row execute function set_updated_at();

-- =============================================================================
-- F. PATIENT UPLOADS
-- (file_url points at a Supabase Storage object path, not the file itself)
-- =============================================================================

create table patient_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(patient_id) on delete cascade,
  booking_id uuid not null references bookings(booking_id) on delete cascade,
  consultation_id uuid references consultations(consultation_id) on delete set null,
  file_name text not null,
  file_size bigint check (file_size is null or file_size > 0),
  file_content_type text,
  title text,
  description text,
  file_url text not null,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index idx_patient_documents_patient_id on patient_documents(patient_id);
create index idx_patient_documents_booking_id on patient_documents(booking_id);

create table patient_lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(patient_id) on delete cascade,
  booking_id uuid not null references bookings(booking_id) on delete cascade,
  consultation_id uuid references consultations(consultation_id) on delete set null,
  -- Links an uploaded result file back to the doctor's original order, when
  -- known — the two concepts (doctor orders a test vs. a file gets uploaded)
  -- are distinct in the docs and aren't always 1:1 in practice.
  lab_order_id uuid references lab_orders(lab_order_id) on delete set null,
  file_name text not null,
  file_content_type text,
  result_title text,
  result_text text,
  status text not null default 'Completed',
  file_url text not null,
  uploaded_at timestamptz not null default now()
);
create index idx_patient_lab_results_patient_id on patient_lab_results(patient_id);
create index idx_patient_lab_results_booking_id on patient_lab_results(booking_id);
create index idx_patient_lab_results_lab_order_id on patient_lab_results(lab_order_id);

-- =============================================================================
-- G. AUDIT & COMMUNICATIONS
-- =============================================================================

-- entity_id is necessarily polymorphic (can't FK across 7 different tables)
-- — standard, accepted audit-log design, not a JSON/text shortcut. Also
-- serves doctor.md's consultation-amendment history (entity_type =
-- 'Consultation') instead of a separate near-duplicate table.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type audit_entity_type not null,
  entity_id uuid not null,
  action text not null,
  performed_by_user_id uuid references auth.users(id) on delete set null,
  details text,
  performed_at timestamptz not null default now()
);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_performed_at on audit_logs(performed_at);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_active boolean not null default true,
  posted_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_announcements_updated_at before update on announcements
  for each row execute function set_updated_at();

-- =============================================================================
-- H. CLINIC SETTINGS
-- =============================================================================

-- Singleton row, enforced via check(id = 1) rather than a table with no key.
create table clinic_settings (
  id smallint primary key default 1,
  clinic_name text not null,
  address text not null,
  contact_number text,
  email text,
  description text,
  default_payment_mode payment_mode not null default 'PayAtClinic',
  refund_policy text,
  consent_version integer not null default 1,
  primary_color text,
  secondary_color text,
  logo_url text,
  favicon_url text,
  website_url text,
  privacy_policy_text text,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (id = 1)
);
create trigger trg_clinic_settings_updated_at before update on clinic_settings
  for each row execute function set_updated_at();

create table clinic_operating_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6), -- 0 = Sunday
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time))
);

-- Normalized alternative to an array/JSON "accepted methods" list column:
-- presence of a row = accepted.
create table clinic_accepted_payment_methods (
  payment_method payment_method primary key
);

-- =============================================================================
-- I. REPORTING VIEWS
-- admin.md §13 says this explicitly: "aggregation views, not base tables."
-- =============================================================================

create view v_unpaid_completed_visits as
select
  b.booking_id,
  b.patient_id,
  p.patient_code,
  p.first_name || ' ' || p.last_name as patient_name,
  b.doctor_id,
  sa.full_name as doctor_name,
  b.appointment_date,
  pay.amount as amount_due,
  pay.status as payment_status
from bookings b
join patients p on p.patient_id = b.patient_id
join doctors d on d.doctor_id = b.doctor_id
join staff_accounts sa on sa.staff_id = d.doctor_id
join payments pay on pay.booking_id = b.booking_id
where b.status = 'Completed' and pay.status = 'Unpaid';

create view v_pending_follow_ups as
select
  f.id as follow_up_id,
  f.patient_id,
  p.first_name || ' ' || p.last_name as patient_name,
  f.doctor_id,
  sa.full_name as doctor_name,
  f.follow_up_date,
  f.reason,
  f.status
from follow_ups f
join patients p on p.patient_id = f.patient_id
join doctors d on d.doctor_id = f.doctor_id
join staff_accounts sa on sa.staff_id = d.doctor_id
where f.status = 'Pending';

create view v_daily_booking_summary as
select
  b.appointment_date,
  count(*) as total_bookings,
  count(*) filter (where b.status = 'Completed') as completed_count,
  count(*) filter (where pay.status = 'Paid') as paid_count,
  count(*) filter (where pay.status = 'Unpaid') as unpaid_count,
  count(*) filter (where b.status = 'NoShow') as no_show_count,
  coalesce(sum(pay.amount) filter (where pay.status = 'Paid'), 0) as revenue
from bookings b
left join payments pay on pay.booking_id = b.booking_id
group by b.appointment_date;

-- Replaces the stored doctors.rating/reviewCount columns from doctor.md so
-- the average can never drift out of sync with the underlying reviews.
create view v_doctor_ratings as
select
  d.doctor_id,
  coalesce(round(avg(r.rating), 2), 0) as average_rating,
  count(r.review_id) as review_count
from doctors d
left join reviews r on r.doctor_id = d.doctor_id
group by d.doctor_id;

-- =============================================================================
-- SEED DATA
-- Structural seeds only (rows the app cannot function without). Business/
-- demo data belongs in a separate supabase/seed.sql in the implementation
-- phase, not here.
-- =============================================================================

insert into clinic_settings (id, clinic_name, address)
values (1, 'Dr. Grace Gavino Medical Clinic', 'TBD')
on conflict (id) do nothing;

insert into clinic_operating_hours (day_of_week, is_closed, open_time, close_time)
values
  (0, true, null, null),
  (1, false, '08:00', '17:00'),
  (2, false, '08:00', '17:00'),
  (3, false, '08:00', '17:00'),
  (4, false, '08:00', '17:00'),
  (5, false, '08:00', '17:00'),
  (6, false, '08:00', '12:00')
on conflict (day_of_week) do nothing;

insert into clinic_accepted_payment_methods (payment_method)
values ('Cash'), ('GCash'), ('Maya'), ('BankTransfer')
on conflict (payment_method) do nothing;

-- Starter ICD-10 set only (matches the mock data already in the frontend) —
-- a real deployment bulk-loads the full WHO/CDC ICD-10-CM release instead.
insert into icd10_codes (code, description) values
  ('Z00.0', 'General health examination'),
  ('I10', 'Essential (primary) hypertension'),
  ('J06.9', 'Acute upper respiratory infection, unspecified'),
  ('E11.9', 'Type 2 diabetes mellitus without complications'),
  ('J45.909', 'Unspecified asthma, uncomplicated')
on conflict (code) do nothing;

-- The 7 standard "design templates" from clinic-vitals-fe.md (is_default =
-- true), plus the two example custom ones the mock data already uses
-- (is_default = false) — without at least the defaults, the Vitals UI has
-- nothing to render, so this is structural, not demo data.
insert into vital_field_templates (description, form_key, unit, icon, is_default) values
  ('TEMPERATURE', 'temperature', '°C', 'thermometer', true),
  ('PULSE RATE', 'pulse_rate', 'bpm', 'heart_pulse', true),
  ('RESPIRATORY RATE', 'respiratory_rate', 'rpm', 'lungs', true),
  ('BLOOD PRESSURE', 'blood_pressure', 'mmHg', 'gauge', true),
  ('O2 SATURATION', 'o2_saturation', '%', 'wind', true),
  ('HEIGHT', 'height', 'cm', 'ruler', true),
  ('WEIGHT', 'weight', 'kg', 'weight_scale', true),
  ('Fundal Height', 'fundal_height', '', 'ruler', false),
  ('Fetal Heart Rate', 'fetal_heart_rate', '', 'heart_pulse', false)
on conflict (form_key) do nothing;

-- Starter medicine catalog only (matches the mock data already in the
-- frontend) — a real deployment loads the clinic's actual formulary instead.
insert into medicines (generic_name) values
  ('PARACETAMOL 500MG TAB'),
  ('AMOXICILLIN + CLAVULANIC ACID (CO-AMOXICLAV) 500MG TAB'),
  ('CEFIXIME 200MG TAB'),
  ('LOPERAMIDE 2MG CAP'),
  ('MEFENAMIC ACID 500MG TAB'),
  ('CETIRIZINE 10MG TAB'),
  ('OMEPRAZOLE 20MG CAP'),
  ('METFORMIN 500MG TAB'),
  ('LOSARTAN 50MG TAB'),
  ('ASCORBIC ACID + MULTIVITAMINS 500MG TAB'),
  ('SALBUTAMOL 2MG/5ML SYRUP'),
  ('AMLODIPINE 5MG TAB'),
  ('AZITHROMYCIN 500MG TAB'),
  ('IBUPROFEN 400MG TAB'),
  ('SIMVASTATIN 20MG TAB')
on conflict (generic_name) do nothing;
