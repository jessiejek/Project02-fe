-- =============================================================================
-- Row Level Security (remaining.md B.1)
--
-- Run once in the Supabase SQL editor after schema.sql.
-- Safe-ish to re-run: drops/recreates helper functions and policies by name.
--
-- Design:
--   • Patients only touch their own clinical rows (via patients.user_id).
--   • Staff / Doctor / Admin ("staff-like") get clinic-wide access needed by
--     the existing client-side Admin/Staff/Doctor UIs.
--   • Public /booking wizard (anon) can READ catalog data: doctors, schedules,
--     services, ratings. It cannot write patient data until signed in.
--   • Profile / role assignment stays server-only (service role) — no client
--     INSERT/UPDATE on profiles.
--
-- After running: confirm Dashboard → Authentication → Policies shows RLS ON
-- for the tables below. Service-role server actions continue to bypass RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policy checks don't recurse into RLS)
-- -----------------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff_like()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('Staff', 'Doctor', 'Admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Admin'
  );
$$;

create or replace function public.current_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select patient_id from public.patients where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select staff_id from public.staff_accounts where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.doctor_id
  from public.doctors d
  join public.staff_accounts s on s.staff_id = d.doctor_id
  where s.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.owns_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bookings b
    where b.booking_id = p_booking_id
      and b.patient_id = public.current_patient_id()
  );
$$;

grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_staff_like() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_patient_id() to anon, authenticated;
grant execute on function public.current_staff_id() to anon, authenticated;
grant execute on function public.current_doctor_id() to anon, authenticated;
grant execute on function public.owns_booking(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS on all public tables
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.staff_accounts enable row level security;
alter table public.doctors enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.doctor_blocked_dates enable row level security;
alter table public.doctor_day_statuses enable row level security;
alter table public.services enable row level security;
alter table public.doctor_services enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_services enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.consultations enable row level security;
alter table public.vital_field_templates enable row level security;
alter table public.patient_vital_readings enable row level security;
alter table public.follow_ups enable row level security;
alter table public.icd10_codes enable row level security;
alter table public.consultation_diagnoses enable row level security;
alter table public.soap_phrases enable row level security;
alter table public.soap_templates enable row level security;
alter table public.medicines enable row level security;
alter table public.prescription_groups enable row level security;
alter table public.prescription_line_items enable row level security;
alter table public.doctor_favorite_medicines enable row level security;
alter table public.prescription_templates enable row level security;
alter table public.prescription_template_items enable row level security;
alter table public.lab_orders enable row level security;
alter table public.patient_vaccinations enable row level security;
alter table public.patient_documents enable row level security;
alter table public.patient_lab_results enable row level security;
alter table public.audit_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.clinic_operating_hours enable row level security;
alter table public.clinic_accepted_payment_methods enable row level security;

-- Views must invoke as the caller so underlying table RLS applies.
alter view public.v_unpaid_completed_visits set (security_invoker = true);
alter view public.v_pending_follow_ups set (security_invoker = true);
alter view public.v_daily_booking_summary set (security_invoker = true);
alter view public.v_doctor_ratings set (security_invoker = true);

-- =============================================================================
-- POLICIES
-- =============================================================================

-- ---------- profiles ----------
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff_like());

-- No insert/update/delete for authenticated — service role only.

-- ---------- patients ----------
drop policy if exists "patients_select_own_or_staff" on public.patients;
create policy "patients_select_own_or_staff"
  on public.patients for select to authenticated
  using (user_id = auth.uid() or public.is_staff_like());

drop policy if exists "patients_update_own_or_staff" on public.patients;
create policy "patients_update_own_or_staff"
  on public.patients for update to authenticated
  using (user_id = auth.uid() or public.is_staff_like())
  with check (user_id = auth.uid() or public.is_staff_like());

drop policy if exists "patients_insert_staff" on public.patients;
create policy "patients_insert_staff"
  on public.patients for insert to authenticated
  with check (public.is_staff_like());

drop policy if exists "patients_delete_staff" on public.patients;
create policy "patients_delete_staff"
  on public.patients for delete to authenticated
  using (public.is_staff_like());

-- ---------- staff_accounts ----------
-- Anon/patients may read Active Doctor rows (booking wizard + doctor browse).
drop policy if exists "staff_accounts_select_doctors_or_staff" on public.staff_accounts;
create policy "staff_accounts_select_doctors_or_staff"
  on public.staff_accounts for select to anon, authenticated
  using (
    public.is_staff_like()
    or (role = 'Doctor' and status is distinct from 'Inactive')
    or user_id = auth.uid()
  );

drop policy if exists "staff_accounts_update_own_or_admin" on public.staff_accounts;
create policy "staff_accounts_update_own_or_admin"
  on public.staff_accounts for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "staff_accounts_insert_admin" on public.staff_accounts;
create policy "staff_accounts_insert_admin"
  on public.staff_accounts for insert to authenticated
  with check (public.is_admin());

drop policy if exists "staff_accounts_delete_admin" on public.staff_accounts;
create policy "staff_accounts_delete_admin"
  on public.staff_accounts for delete to authenticated
  using (public.is_admin());

-- ---------- doctors + schedule catalog (public read) ----------
drop policy if exists "doctors_select_all" on public.doctors;
create policy "doctors_select_all"
  on public.doctors for select to anon, authenticated
  using (true);

drop policy if exists "doctors_write_staff" on public.doctors;
create policy "doctors_write_staff"
  on public.doctors for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "doctor_schedules_select_all" on public.doctor_schedules;
create policy "doctor_schedules_select_all"
  on public.doctor_schedules for select to anon, authenticated
  using (true);

drop policy if exists "doctor_schedules_write_own_or_staff" on public.doctor_schedules;
create policy "doctor_schedules_write_own_or_staff"
  on public.doctor_schedules for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "doctor_blocked_dates_select_all" on public.doctor_blocked_dates;
create policy "doctor_blocked_dates_select_all"
  on public.doctor_blocked_dates for select to anon, authenticated
  using (true);

drop policy if exists "doctor_blocked_dates_write_staff" on public.doctor_blocked_dates;
create policy "doctor_blocked_dates_write_staff"
  on public.doctor_blocked_dates for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "doctor_day_statuses_select_all" on public.doctor_day_statuses;
create policy "doctor_day_statuses_select_all"
  on public.doctor_day_statuses for select to anon, authenticated
  using (true);

drop policy if exists "doctor_day_statuses_write_staff" on public.doctor_day_statuses;
create policy "doctor_day_statuses_write_staff"
  on public.doctor_day_statuses for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "services_select_all" on public.services;
create policy "services_select_all"
  on public.services for select to anon, authenticated
  using (true);

drop policy if exists "services_write_staff" on public.services;
create policy "services_write_staff"
  on public.services for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "doctor_services_select_all" on public.doctor_services;
create policy "doctor_services_select_all"
  on public.doctor_services for select to anon, authenticated
  using (true);

drop policy if exists "doctor_services_write_staff" on public.doctor_services;
create policy "doctor_services_write_staff"
  on public.doctor_services for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

-- ---------- bookings ----------
drop policy if exists "bookings_select_own_or_staff" on public.bookings;
create policy "bookings_select_own_or_staff"
  on public.bookings for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "bookings_insert_own_or_staff" on public.bookings;
create policy "bookings_insert_own_or_staff"
  on public.bookings for insert to authenticated
  with check (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "bookings_update_own_or_staff" on public.bookings;
create policy "bookings_update_own_or_staff"
  on public.bookings for update to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like())
  with check (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "bookings_delete_staff" on public.bookings;
create policy "bookings_delete_staff"
  on public.bookings for delete to authenticated
  using (public.is_staff_like());

-- ---------- booking_services ----------
drop policy if exists "booking_services_select_own_or_staff" on public.booking_services;
create policy "booking_services_select_own_or_staff"
  on public.booking_services for select to authenticated
  using (public.owns_booking(booking_id) or public.is_staff_like());

drop policy if exists "booking_services_write_own_or_staff" on public.booking_services;
create policy "booking_services_write_own_or_staff"
  on public.booking_services for all to authenticated
  using (public.owns_booking(booking_id) or public.is_staff_like())
  with check (public.owns_booking(booking_id) or public.is_staff_like());

-- ---------- payments ----------
drop policy if exists "payments_select_own_or_staff" on public.payments;
create policy "payments_select_own_or_staff"
  on public.payments for select to authenticated
  using (public.owns_booking(booking_id) or public.is_staff_like());

drop policy if exists "payments_insert_own_or_staff" on public.payments;
create policy "payments_insert_own_or_staff"
  on public.payments for insert to authenticated
  with check (public.owns_booking(booking_id) or public.is_staff_like());

drop policy if exists "payments_update_own_or_staff" on public.payments;
create policy "payments_update_own_or_staff"
  on public.payments for update to authenticated
  using (public.owns_booking(booking_id) or public.is_staff_like())
  with check (public.owns_booking(booking_id) or public.is_staff_like());

drop policy if exists "payments_delete_staff" on public.payments;
create policy "payments_delete_staff"
  on public.payments for delete to authenticated
  using (public.is_staff_like());

-- ---------- reviews ----------
drop policy if exists "reviews_select_authenticated" on public.reviews;
create policy "reviews_select_authenticated"
  on public.reviews for select to authenticated
  using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews for insert to authenticated
  with check (
    patient_id = public.current_patient_id()
    and public.owns_booking(booking_id)
  );

drop policy if exists "reviews_staff_all" on public.reviews;
create policy "reviews_staff_all"
  on public.reviews for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

-- ---------- consultations + diagnoses ----------
drop policy if exists "consultations_select_own_or_staff" on public.consultations;
create policy "consultations_select_own_or_staff"
  on public.consultations for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "consultations_write_staff" on public.consultations;
create policy "consultations_write_staff"
  on public.consultations for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "consultation_diagnoses_select_own_or_staff" on public.consultation_diagnoses;
create policy "consultation_diagnoses_select_own_or_staff"
  on public.consultation_diagnoses for select to authenticated
  using (
    public.is_staff_like()
    or exists (
      select 1 from public.consultations c
      where c.consultation_id = consultation_diagnoses.consultation_id
        and c.patient_id = public.current_patient_id()
    )
  );

drop policy if exists "consultation_diagnoses_write_staff" on public.consultation_diagnoses;
create policy "consultation_diagnoses_write_staff"
  on public.consultation_diagnoses for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

-- ---------- vitals ----------
drop policy if exists "vital_templates_select_authenticated" on public.vital_field_templates;
create policy "vital_templates_select_authenticated"
  on public.vital_field_templates for select to authenticated
  using (true);

drop policy if exists "vital_templates_write_admin" on public.vital_field_templates;
create policy "vital_templates_write_admin"
  on public.vital_field_templates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "patient_vital_readings_select_own_or_staff" on public.patient_vital_readings;
create policy "patient_vital_readings_select_own_or_staff"
  on public.patient_vital_readings for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_vital_readings_write_staff" on public.patient_vital_readings;
create policy "patient_vital_readings_write_staff"
  on public.patient_vital_readings for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

-- ---------- follow_ups ----------
drop policy if exists "follow_ups_select_own_or_staff" on public.follow_ups;
create policy "follow_ups_select_own_or_staff"
  on public.follow_ups for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "follow_ups_write_staff" on public.follow_ups;
create policy "follow_ups_write_staff"
  on public.follow_ups for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

-- ---------- reference catalogs ----------
drop policy if exists "icd10_select_authenticated" on public.icd10_codes;
create policy "icd10_select_authenticated"
  on public.icd10_codes for select to authenticated
  using (true);

drop policy if exists "icd10_write_admin" on public.icd10_codes;
create policy "icd10_write_admin"
  on public.icd10_codes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "medicines_select_authenticated" on public.medicines;
create policy "medicines_select_authenticated"
  on public.medicines for select to authenticated
  using (true);

drop policy if exists "medicines_write_admin" on public.medicines;
create policy "medicines_write_admin"
  on public.medicines for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- SOAP ----------
drop policy if exists "soap_phrases_select_authenticated" on public.soap_phrases;
create policy "soap_phrases_select_authenticated"
  on public.soap_phrases for select to authenticated
  using (true);

drop policy if exists "soap_phrases_write_staff" on public.soap_phrases;
create policy "soap_phrases_write_staff"
  on public.soap_phrases for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "soap_templates_select_authenticated" on public.soap_templates;
create policy "soap_templates_select_authenticated"
  on public.soap_templates for select to authenticated
  using (is_system_template or doctor_id = public.current_doctor_id() or public.is_staff_like());

drop policy if exists "soap_templates_write_staff" on public.soap_templates;
create policy "soap_templates_write_staff"
  on public.soap_templates for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

-- ---------- prescriptions ----------
drop policy if exists "prescription_groups_select_own_or_staff" on public.prescription_groups;
create policy "prescription_groups_select_own_or_staff"
  on public.prescription_groups for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "prescription_groups_write_staff" on public.prescription_groups;
create policy "prescription_groups_write_staff"
  on public.prescription_groups for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "prescription_line_items_select_own_or_staff" on public.prescription_line_items;
create policy "prescription_line_items_select_own_or_staff"
  on public.prescription_line_items for select to authenticated
  using (
    public.is_staff_like()
    or exists (
      select 1 from public.prescription_groups g
      where g.group_id = prescription_line_items.group_id
        and g.patient_id = public.current_patient_id()
    )
  );

drop policy if exists "prescription_line_items_write_staff" on public.prescription_line_items;
create policy "prescription_line_items_write_staff"
  on public.prescription_line_items for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "doctor_favorite_medicines_staff" on public.doctor_favorite_medicines;
create policy "doctor_favorite_medicines_staff"
  on public.doctor_favorite_medicines for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "prescription_templates_staff" on public.prescription_templates;
create policy "prescription_templates_staff"
  on public.prescription_templates for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "prescription_template_items_staff" on public.prescription_template_items;
create policy "prescription_template_items_staff"
  on public.prescription_template_items for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

-- ---------- lab orders / documents / lab results / vaccinations ----------
drop policy if exists "lab_orders_select_own_or_staff" on public.lab_orders;
create policy "lab_orders_select_own_or_staff"
  on public.lab_orders for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "lab_orders_write_staff" on public.lab_orders;
create policy "lab_orders_write_staff"
  on public.lab_orders for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "patient_vaccinations_select_own_or_staff" on public.patient_vaccinations;
create policy "patient_vaccinations_select_own_or_staff"
  on public.patient_vaccinations for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_vaccinations_write_staff" on public.patient_vaccinations;
create policy "patient_vaccinations_write_staff"
  on public.patient_vaccinations for all to authenticated
  using (public.is_staff_like())
  with check (public.is_staff_like());

drop policy if exists "patient_documents_select_own_or_staff" on public.patient_documents;
create policy "patient_documents_select_own_or_staff"
  on public.patient_documents for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_documents_insert_own_or_staff" on public.patient_documents;
create policy "patient_documents_insert_own_or_staff"
  on public.patient_documents for insert to authenticated
  with check (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_documents_update_own_or_staff" on public.patient_documents;
create policy "patient_documents_update_own_or_staff"
  on public.patient_documents for update to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like())
  with check (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_documents_delete_own_or_staff" on public.patient_documents;
create policy "patient_documents_delete_own_or_staff"
  on public.patient_documents for delete to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_lab_results_select_own_or_staff" on public.patient_lab_results;
create policy "patient_lab_results_select_own_or_staff"
  on public.patient_lab_results for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_lab_results_insert_own_or_staff" on public.patient_lab_results;
create policy "patient_lab_results_insert_own_or_staff"
  on public.patient_lab_results for insert to authenticated
  with check (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_lab_results_update_own_or_staff" on public.patient_lab_results;
create policy "patient_lab_results_update_own_or_staff"
  on public.patient_lab_results for update to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like())
  with check (patient_id = public.current_patient_id() or public.is_staff_like());

drop policy if exists "patient_lab_results_delete_own_or_staff" on public.patient_lab_results;
create policy "patient_lab_results_delete_own_or_staff"
  on public.patient_lab_results for delete to authenticated
  using (patient_id = public.current_patient_id() or public.is_staff_like());

-- ---------- audit / announcements / clinic settings ----------
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
  on public.audit_logs for select to authenticated
  using (public.is_admin());

drop policy if exists "audit_logs_insert_staff" on public.audit_logs;
create policy "audit_logs_insert_staff"
  on public.audit_logs for insert to authenticated
  with check (public.is_staff_like());

drop policy if exists "announcements_select_authenticated" on public.announcements;
create policy "announcements_select_authenticated"
  on public.announcements for select to authenticated
  using (is_active or public.is_staff_like());

drop policy if exists "announcements_write_admin" on public.announcements;
create policy "announcements_write_admin"
  on public.announcements for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "clinic_settings_select_authenticated" on public.clinic_settings;
create policy "clinic_settings_select_authenticated"
  on public.clinic_settings for select to authenticated
  using (true);

drop policy if exists "clinic_settings_write_admin" on public.clinic_settings;
create policy "clinic_settings_write_admin"
  on public.clinic_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "clinic_operating_hours_select_authenticated" on public.clinic_operating_hours;
create policy "clinic_operating_hours_select_authenticated"
  on public.clinic_operating_hours for select to authenticated
  using (true);

drop policy if exists "clinic_operating_hours_write_admin" on public.clinic_operating_hours;
create policy "clinic_operating_hours_write_admin"
  on public.clinic_operating_hours for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "clinic_payment_methods_select_authenticated" on public.clinic_accepted_payment_methods;
create policy "clinic_payment_methods_select_authenticated"
  on public.clinic_accepted_payment_methods for select to authenticated
  using (true);

drop policy if exists "clinic_payment_methods_write_admin" on public.clinic_accepted_payment_methods;
create policy "clinic_payment_methods_write_admin"
  on public.clinic_accepted_payment_methods for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
