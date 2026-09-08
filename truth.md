# Project Truth Audit

Next.js App Router + Supabase clinic booking system (Dr. Grace E. Gavino Medical Clinic). Role gating lives in `src/middleware.ts`, not in individual page components — every route's role check ultimately traces back there. Session identity (`profiles.role`, `staffId`/`patientId`) is resolved once per client-side mount by `SessionProvider.tsx` → `useSession()`.

## Roles

- **Patient** — `profiles.role = 'Patient'`. Has a linked `patients` row (`session.patientId`). Self-service signup via the public `/booking` wizard (client-side `auth.signUp` + direct insert into `profiles`/`patients` — not a server action).
- **Staff** — `profiles.role = 'Staff'`. Has a `staff_accounts` row (`session.staffId`). Provisioned only via Admin's Invite Staff flow (server action, service-role key).
- **Doctor** — `profiles.role = 'Doctor'`. Has both a `staff_accounts` row and a 1:1 `doctors` row keyed on the same id (`staffId` doubles as `doctorId`). Provisioned only via Admin's Add Doctor flow (server action).
- **Admin** — `profiles.role = 'Admin'`. Has a `staff_accounts` row. No self-service or UI-driven creation path found anywhere in this codebase (must be seeded directly in the database).

`middleware.ts` maps the first URL segment (`/patient`, `/staff`, `/doctor`, `/admin`) to the expected role segment; a mismatch redirects to the user's own `/{segment}/dashboard`, or to `/login` if unauthenticated or roleless. `/`, `/login`, and everything under `/booking` are the only public paths.

---

## Admin

### /admin/dashboard
**Logic:** On mount, fires 9 parallel queries for today/month stats, doctor booking-load bar chart (top 20 most-recent bookings, not date-scoped), and a 20-row recent-bookings table. Clicking a row routes to `/admin/bookings/[id]`.
**API Calls:**
- `v_daily_booking_summary` — select — `.eq(appointment_date, today)` — on mount
- `bookings` — select (count only) — `.gte(appointment_date, monthStart)` — on mount
- `v_daily_booking_summary` — select — `.gte(appointment_date, monthStart)` — on mount
- `bookings` — select (count) — `.eq(status, 'ProofSubmitted')` — on mount
- `bookings` — select (count) — `.eq(status,'OnHold').gte(appointment_date, monthStart)` — on mount
- `v_unpaid_completed_visits` — select (count) — on mount
- `v_pending_follow_ups` — select (count) — `.gte/.lte(follow_up_date, today..+7d)` — on mount
- `doctors` — select w/ `staff_accounts(full_name)` — on mount
- `bookings` — select w/ `patients`, `doctors→staff_accounts` — `.order(created_at desc).limit(20)` — on mount

### /admin/bookings
**Logic:** Loads all bookings + all booking_services + all doctors, joins client-side. Client-side filters: doctor, status, date (bug: date filter input renders but works), search. Row click → `/admin/bookings/[id]`. "New Walk-In" links to `/admin/walk-in`.
**API Calls:**
- `bookings` — select w/ `patients`, `doctors→staff_accounts` — `.order(created_at desc)` — on mount
- `booking_services` — select w/ `services(name)` — unfiltered (all rows) — on mount
- `doctors` — select w/ `staff_accounts(full_name)` — on mount
- `payments` — select `(booking_id, status)` — unfiltered (all rows) — on mount

### /admin/bookings/[id]
**Logic:** Loads one booking + services + payment. Status-gated action buttons drive a state machine: Pending→Confirm/Reject; ProofSubmitted→Confirm Payment (writes booking+payment together)/Reject; Confirmed→Complete/NoShow/Reschedule/Cancel; Completed→Print Receipt (modal only). Waive/Refund payment modals require a reason (and amount, for refund). Reject/Cancel/Reject-Proof all terminate in status `Cancelled` (no distinct "Rejected" status exists in the schema — flagged in-code as an open question).
**API Calls:**
- `bookings` — select w/ `patients`, `doctors→staff_accounts` — `.eq(booking_id).single()` — on mount
- `booking_services` — select w/ `services(name)` — `.eq(booking_id)` — on mount
- `payments` — select — `.eq(booking_id).single()` — on mount
- `bookings` — update `(status, cancellation_reason)` — `.eq(booking_id)` — on Confirm/Reject/Complete/NoShow/Reschedule/Cancel (`updateBooking()`)
- `payments` — update `(status, or_number, waived_/refund_ fields)` — `.eq(booking_id)` — on Confirm Payment/Waive/Refund (`updatePayment()`)

### /admin/doctors
**Logic:** Lists doctors joined with active schedule days. Deactivate sets `staff_accounts.status = 'Inactive'` after a confirm modal (doesn't touch `doctors` row). "+ Add Doctor" → `/admin/doctors/new`; Edit → `/admin/doctors/[id]/edit`.
**API Calls:**
- `doctors` — select w/ `staff_accounts(full_name,status)` — on mount
- `doctor_schedules` — select — `.eq(is_active,true)` — on mount
- `staff_accounts` — update `{status:'Inactive'}` — `.eq(staff_id)` — on Deactivate confirm

### /admin/doctors/new
**Logic:** Renders shared `DoctorForm` (mode="create"). Client-side validates required fields + per-day schedule `end_time > start_time`. Submits via server action `createDoctor`.
**API Calls:**
- `services` — select `*` — `.order(name)` — on mount (to populate "Assign to Services" checklist)
- `createDoctor` server action → internally: `profiles.insert`, `staff_accounts.insert`, `doctors.insert`, `doctor_services.insert`, `doctor_schedules.insert`, plus `auth.admin.inviteUserByEmail` and rollback `auth.admin.deleteUser` on any step failing. Caller-role check (`Admin`) enforced server-side before any write.

### /admin/doctors/[id]/edit
**Logic:** Server component — fetches doctor + doctor_services + schedule server-side, passes as props into shared `DoctorForm` (mode="edit"). Save writes directly via client Supabase (no server action) across 4 tables: doctor profile fields, `staff_accounts.full_name/status`, delete-then-reinsert `doctor_services`, upsert `doctor_schedules`.
**API Calls:**
- `doctors` — select w/ `staff_accounts` — `.eq(doctor_id).single()` — on page render (server)
- `doctor_services` — select w/ `services(name,category,price)` — `.eq(doctor_id)` — on page render
- `doctor_schedules` — select — `.eq(doctor_id).order(day_of_week)` — on page render
- `doctors` — update — `.eq(doctor_id)` — on Save
- `staff_accounts` — update `{full_name,status}` — `.eq(staff_id)` — on Save
- `doctor_services` — delete `.eq(doctor_id)` then insert (bulk) — on Save
- `doctor_schedules` — upsert (onConflict `doctor_id,day_of_week`) — on Save

### /admin/patients
**Logic:** Lists all patients; derives `accountStatus` (LinkedAccount/NoAccount/AccountUnknown) from `user_id`/`is_guest`. Client-side search. "Add Patient" modal inserts a guest patient (`is_guest:true, user_id:null`) with a generated `MF-####` code. Row click → `/admin/patients/[id]`.
**API Calls:**
- `patients` — select `*` — `.order(created_at desc)` — on mount
- `patients` — insert (guest record) — on Add Patient submit

### /admin/patients/[id]
**Logic:** **Runs entirely on mock data** (`mockPatientSummaries`, `mockBookings`, `mockConsultations`) — no Supabase calls at all. "Edit Patient" modal's Save button closes the modal without persisting anything.
**API Calls:** None.

### /admin/reports
**Logic:** **Runs entirely on mock data** (`mockBookings`, `mockConsultations`, `mockPatientSummaries`). Date-range client-side filtering computes unpaid-completed visits, pending follow-ups, and a daily booking summary table. "Export CSV" and "Send Reminder" are explicitly disabled/"Coming soon".
**API Calls:** None.

### /admin/services
**Logic:** Lists services grouped by category. Toggle switch flips `is_active`. Add/Edit modal writes name/category/description/price. Delete is a hard delete (no soft-delete path despite the separate `isActive` flag). "Assigned Doctors" checklist in the modal is display-only (reads `mockDoctors`, never persisted — `doctor_services` isn't written from here).
**API Calls:**
- `services` — select `*` — `.order(category).order(name)` — on mount
- `services` — update `{is_active}` — `.eq(service_id)` — on toggle
- `services` — insert — on Save (new)
- `services` — update `{name,category,description,price}` — `.eq(service_id)` — on Save (edit)
- `services` — delete — `.eq(service_id)` — on Delete confirm

### /admin/calendar
**Logic:** **Runs entirely on mock data** (`mockDoctors`, `mockBookings`). Read-only weekly grid with prev/next week navigation; no click-through on any cell.
**API Calls:** None.

### /admin/walk-in
**Logic:** **Runs entirely on mock data** (`mockDoctors`, `mockPatientSummaries`). 3-step wizard (Patient→Slot→Review); date is locked to a hardcoded string. "Create Booking" button has no `onClick` at all — fully decorative.
**API Calls:** None.

### /admin/staff
**Logic:** Lists Staff-role accounts. Invite form submits via server action `inviteStaffMember`. Revoke (only for status `Invited`) via server action `revokeStaffInvite`. Toggle Active/Inactive writes directly.
**API Calls:**
- `staff_accounts` — select `*` — `.eq(role,'Staff').order(full_name)` — on mount
- `inviteStaffMember` server action → `auth.admin.inviteUserByEmail`, `profiles.insert`, `staff_accounts.insert` (role check: caller must be Admin; rolls back via `auth.admin.deleteUser` on any failure)
- `revokeStaffInvite` server action → `staff_accounts.select` (must be status `Invited`), `auth.admin.deleteUser` (cascades)
- `staff_accounts` — update `{status}` — `.eq(staff_id)` — on Activate/Deactivate

### /admin/announcements
**Logic:** **Runs entirely on mock/in-memory data** (`mockAnnouncements`, seeded into local state). Full CRUD UI (create/edit/toggle/delete) but nothing persists past a refresh — no Supabase calls anywhere on this page.
**API Calls:** None.

### /admin/settings
**Logic:** 5-tab settings form (General/Hours/Payments/Privacy/Branding). Each tab's Save button writes only that tab's fields. Logo/Favicon upload is local-preview-only (`URL.createObjectURL`) and deliberately never persisted. "Bump Consent Version" requires a second confirm click (re-triggers the consent banner clinic-wide).
**API Calls:**
- `clinic_settings` — select — `.eq(id,1).single()` — on mount
- `clinic_operating_hours` — select — `.order(day_of_week)` — on mount
- `clinic_accepted_payment_methods` — select `payment_method` — on mount
- `clinic_settings` — update (general/payments/privacy fields) — `.eq(id,1)` — on Save (per-tab)
- `clinic_accepted_payment_methods` — delete-all then bulk insert — on Payments tab Save
- `clinic_operating_hours` — upsert (onConflict `day_of_week`) — on Hours tab Save
- `clinic_settings` — update `{consent_version:+1}` — `.eq(id,1)` — on Bump Consent Version confirm

### /admin/audit-logs
**Logic:** **Runs entirely on mock data** (`mockAuditLogs`). Client-side filter by entity type, date range, search. Notably, real `audit_logs` rows ARE written elsewhere (doctor consultation amend flow) but this page never reads that table.
**API Calls:** None.

---

## Doctor

### /doctor/dashboard
**Logic:** Resolves own name + today's day-status + today's booking queue (sorted by queue number). "Up Next" card shows the first `Confirmed` booking with links into consultation/patient chart. Availability buttons upsert today's day-status.
**API Calls:**
- `staff_accounts` — select `full_name` — `.eq(staff_id, meDoctorId).single()` — on mount
- `doctor_day_statuses` — select — `.eq(doctor_id).eq(status_date, today).maybeSingle()` — on mount
- `bookings` — select w/ `patients`, `booking_services→services` — `.eq(doctor_id).eq(appointment_date, today)` — on mount
- `doctor_day_statuses` — upsert (onConflict `doctor_id,status_date`) — on Available/RunningLate/UnavailableToday click

### /doctor/appointments
**Logic:** Lists own bookings (all dates), joined client-side with services/payments (both fetched **unfiltered — all doctors' rows**, then matched by booking_id in JS). Client search filter. Row action routes to consultation (if CheckedIn/InProgress) or detail view otherwise.
**API Calls:**
- `bookings` — select `*` — `.eq(doctor_id).order(appointment_date desc)` — on mount
- `booking_services` — select `(booking_id, services(name))` — unfiltered — on mount
- `payments` — select `(booking_id, status)` — unfiltered — on mount

### /doctor/appointments/[id]
**Logic:** Server component. Redirects to `/login` if unauthenticated or no staff row. Fetches one booking **scoped to `.eq(doctor_id, own staffId)`** (correct ownership check, unlike several other detail pages) plus its consultation summary if completed. Buttons route into `/doctor/consultation/[id]` with a `mode` query param (complete/view/amend).
**API Calls:**
- `staff_accounts` — select `staff_id` — `.eq(user_id).single()` — on render
- `bookings` — select w/ `patients`, `booking_services→services`, `payments` — `.eq(booking_id).eq(doctor_id, own).maybeSingle()` — on render
- `consultations` — select `(chief_complaint, assessment, plan)` — `.eq(booking_id).maybeSingle()` — on render

### /doctor/consultation/[bookingId]
**Logic:** The largest screen in the app — an 8-section accordion (SOAP, Vitals, Diagnosis, Prescription, Lab Orders, Vaccinations, Follow-up, Professional Fee) with 3 modes (complete/view/amend) and keyboard shortcuts (Ctrl+1-8 jump, Ctrl+S save, Ctrl+Enter complete). Completion is gated only on sections 1-3 (Chief Complaint, BP+HR vitals, ≥1 diagnosis). Lab Orders/Vaccinations/Professional-Fee sections are **local-only state — no backing table, never persisted**. Applying a SOAP template overwrites all 5 SOAP fields (confirms first if any field has content). "Last Visit SOAP" looks up the most recent prior consultation for the *same patient* (excludes current booking).
**API Calls:**
- `bookings` — select w/ `doctors→staff_accounts`, `booking_services→services` — `.eq(booking_id).maybeSingle()` — on mount
- `consultations` — select — `.eq(booking_id).maybeSingle()` — on mount
- `vital_field_templates` — select `*` — `.order(description)` — on mount
- `patient_vital_readings` — select `(template_id,value)` — `.eq(booking_id)` — on mount, and re-read via `reloadVitalReadings()` after the Vitals drawer saves
- `soap_templates` — select — `.or(doctor_id.eq.X, is_system_template.eq.true)` — on mount
- `consultations` — select (patient history) — `.eq(patient_id).neq(booking_id, current)` — on mount
- `prescription_groups` — select w/ `prescription_line_items` — `.eq(booking_id).order(created_at desc).limit(1).maybeSingle()` — on mount
- `consultations` + `patient_vital_readings` — select (prior visit detail) — `.eq(consultation_id)` / `.eq(booking_id, prior)` — on mount, only if a prior consultation exists
- `consultation_diagnoses` + `follow_ups` — select — `.eq(consultation_id)` — on mount, only if a consultation already exists for this booking
- `soap_templates` — insert — on "Save as Template"
- `consultations` — upsert (onConflict `booking_id`) — on Save Draft / Complete / Save Changes (shared `persistConsultation()`)
- `consultation_diagnoses` — delete-then-bulk-insert (onConflict via delete/reinsert, keyed by consultation_id) — same save path
- `follow_ups` — upsert (onConflict `consultation_id`) if a follow-up date is set, else delete — same save path
- `audit_logs` — insert `(entity_type:'Consultation', action:'Amended', ...)` — on Save Changes (amend mode only) — **written but never read anywhere in the app** (admin's audit-logs page uses mock data instead)

### /doctor/consultation/[bookingId]/vitals
**Logic:** Standalone vitals-entry page (also embedded as a Drawer inside the consultation page). **Looks up the booking from `mockBookings`** to render the header/date — for any real booking ID this will 404 (`notFound()`), since mock IDs never match real UUIDs. The `VitalsEditor` component itself is fully real (see below) and would function correctly if reached.
**API Calls (via VitalsEditor):**
- `vital_field_templates` — select `*` — `.order(description)` — on mount
- `patient_vital_readings` — select `(template_id,value)` — `.eq(booking_id)` — on mount
- `patient_vital_readings` — per-template delete (if blank) or upsert (onConflict `booking_id,template_id`) — on Save confirm

### /doctor/patients
**Logic:** **Runs entirely on mock data** (`mockPatientSummaries`, `mockBookings`). Bug: every patient card shows the exact same "Latest visit" (`mockBookings[0]`) regardless of which patient it's for.
**API Calls:** None.

### /doctor/patients/[id]
**Logic:** Tabbed patient chart (Timeline/Appointments/Consultations/Vitals/Prescriptions/Labs/Documents/Vaccinations). Consultations and Prescriptions tabs are real; Timeline/Appointments/Vitals/Labs/Documents/Vaccinations still read mock arrays filtered by `patient.id` (a real UUID, so these mock filters correctly return empty rather than stale fake rows). Vitals "+" add action and prescription edit/copy/delete icons only appear when opened with a `?bookingId=` referral param.
**API Calls:**
- `patients` — select `(patient_id,first_name,last_name,patient_code,sex,date_of_birth,contact_number)` — `.eq(patient_id).maybeSingle()` — on mount
- `consultations` — select w/ `bookings(appointment_date)`, `consultation_diagnoses(custom_description)` — `.eq(patient_id)` — on mount
- `prescription_groups` — select w/ `prescription_line_items` — `.eq(patient_id)` — on mount
- `prescription_groups` — delete — `.eq(group_id)` — on Delete Prescription confirm (only reachable via referral param)

### /doctor/patients/[id]/prescriptions/create
**Logic:** Server component. Redirects to `/login` if unauthenticated/no staff row; 404s if patient not found. If `?copyFrom=` is present, preloads that prescription group's items into the shared `PrescriptionForm` (mode="create").
**API Calls:**
- `staff_accounts` — select `staff_id` — `.eq(user_id).single()` — on render
- `patients` — select `patient_id` — `.eq(patient_id).maybeSingle()` — on render
- `prescription_groups` — select w/ `prescription_line_items` — `.eq(group_id, copyFrom).maybeSingle()` — on render, if `copyFrom` present
- (Form itself, shared `PrescriptionForm` — see below)

### /doctor/patients/[id]/prescriptions/[prescriptionId]
**Logic:** Server component. Same auth/redirect pattern. Fetches the existing prescription group and passes into `PrescriptionForm` (mode="edit").
**API Calls:**
- `staff_accounts` — select `staff_id` — `.eq(user_id).single()` — on render
- `patients` — select `patient_id` — `.eq(patient_id).maybeSingle()` — on render
- `prescription_groups` — select w/ `prescription_line_items` — `.eq(group_id).maybeSingle()` — on render
- **Shared `PrescriptionForm` component (used by both create/edit routes above):**
  - `medicines` — select `*` — `.order(generic_name)` — on mount
  - `doctor_favorite_medicines` — select — `.eq(doctor_id)` — on mount / after favoriting
  - `prescription_templates` — select w/ `prescription_template_items` — `.or(doctor_id.eq.X, is_system_template.eq.true)` — on mount / after template save
  - `prescription_groups` — update `{updated_at}` (edit mode) — `.eq(group_id)` — on Save
  - `prescription_line_items` — delete-then-bulk-insert — `.eq(group_id)` — on Save
  - `prescription_template_items` — insert — when "add to favorites/template" is checked on a new line item
  - `prescription_templates` — insert/update/delete + `prescription_template_items` insert/delete — on template save/delete actions

### /doctor/profile
**Logic:** Loads own doctor+staff row scoped to `session.staffId`. Save writes `doctors` and `staff_accounts` in parallel. Includes a Change Password section that re-verifies the current password via `signInWithPassword` before calling `auth.updateUser`.
**API Calls:**
- `doctors` — select w/ `staff_accounts(full_name,email)` — `.eq(doctor_id).single()` — on mount
- `doctors` — update (specialization/bio/fee/license/ptr/s2) — `.eq(doctor_id)` — on Save
- `staff_accounts` — update `{full_name}` — `.eq(staff_id)` — on Save
- `auth.signInWithPassword` — verify current password — on Update Password
- `auth.updateUser` `{password}` — on Update Password

### /doctor/schedule
**Logic:** Loads slot settings + weekly schedule + blocked dates, all scoped to own `doctorId`. Client-side mirrors the DB's own `end_time > start_time` check constraint before saving. "Add Blocked Date" shows a warning referencing `mockBookings.length` as a stand-in for a real date-scoped affected-patient count (not actually computed from real data).
**API Calls:**
- `doctors` — select `(slot_duration_minutes,slot_capacity,daily_patient_limit)` — `.eq(doctor_id).single()` — on mount
- `doctor_schedules` — select — `.eq(doctor_id).order(day_of_week)` — on mount
- `doctor_blocked_dates` — select — `.eq(doctor_id).order(blocked_date)` — on mount
- `doctors` — update (slot settings) — `.eq(doctor_id)` — on Save
- `doctor_schedules` — upsert (onConflict `doctor_id,day_of_week`) — on Save
- `doctor_blocked_dates` — insert — on Add Blocked Date confirm
- `doctor_blocked_dates` — delete — `.eq(id)` — on remove blocked date

---

## Staff

### /staff/dashboard
**Logic:** Loads today's bookings (all doctors) joined with patient/doctor/payment. Splits into today's queue (Confirmed/CheckedIn), ready-for-payment (Completed+Unpaid), walk-ins today. Check-In toggle flips status between Confirmed/CheckedIn. "Walk-Ins Today" stat links to `/staff/bookings?filter=walkin`, but that page never reads a `filter` query param.
**API Calls:**
- `bookings` — select w/ `patients`, `doctors→staff_accounts`, `payments` — `.eq(appointment_date, today)` — on mount
- `bookings` — update `{status}` — `.eq(booking_id)` — on Check In / Undo Check-In

### /staff/bookings
**Logic:** Lists all bookings (any date, defaulting the date filter to today) joined client-side with services/doctors/payments (services and payments fetched unfiltered). Filters: doctor, status, date (with a "Show all dates" clear). Row click → detail; "New Walk-In" → `/staff/walk-in`.
**API Calls:**
- `bookings` — select w/ `patients`, `doctors→staff_accounts` — `.order(appointment_date desc)` — on mount
- `booking_services` — select `(booking_id, services(name))` — unfiltered — on mount
- `doctors` — select w/ `staff_accounts(full_name)` — on mount
- `payments` — select `(booking_id,status)` — unfiltered — on mount

### /staff/bookings/[id]
**Logic:** Loads one booking (not scoped to any staff/doctor ownership — any signed-in staff can view any booking by ID, which is expected for this role) + services + payment. Status-gated actions: Confirmed→Check In; CheckedIn→Undo; Completed+Unpaid→Confirm Payment (writes payment with method/amount/reference/notes + generates OR number) or Waive PF; Confirmed/CheckedIn→Cancel. Receipt/print modal available once paid/waived.
**API Calls:**
- `bookings` — select w/ `patients`, `doctors→staff_accounts` — `.eq(booking_id).maybeSingle()` — on mount
- `booking_services` — select `(services(name))` — `.eq(booking_id)` — on mount
- `payments` — select — `.eq(booking_id).maybeSingle()` — on mount
- `bookings` — update `{status, cancellation_reason}` — `.eq(booking_id)` — on Check-In/Undo/Cancel
- `payments` — update (status/method/amount/notes/waived fields/or_number) — `.eq(booking_id)` — on Confirm Payment / Waive

### /staff/patients
**Logic:** **Runs entirely on mock data** (`mockPatientSummaries`). Client search filter. Row click → `/staff/patients/[id]`.
**API Calls:** None.

### /staff/patients/[id]
**Logic:** **Runs entirely on mock data** (`mockPatientSummaries`, `mockBookings`, `mockConsultations`). "Create Portal Account" only toggles a local form open/closed — its "Create Account" button has no handler and performs no signup.
**API Calls:** None.

### /staff/profile
**Logic:** **Runs entirely on mock data** — hardcodes `mockStaff[0]` regardless of who is actually signed in (does not use `useSession()` at all). Every field is `defaultValue`-only; Save/Update Password buttons have no handlers.
**API Calls:** None.

### /staff/announcements
**Logic:** **Runs entirely on mock data** (`mockAnnouncements`). Read-only by design (writes are Admin-only).
**API Calls:** None.

### /staff/payments
**Logic:** **Runs entirely on mock/in-memory data** (`mockBookings` seeded into local state). "Confirm Payment" only flips local state to "Paid" — no real write, despite `/staff/bookings/[id]` implementing the real version of this same action.
**API Calls:** None.

### /staff/doctor-status
**Logic:** **Runs entirely on mock/in-memory data** (`mockDoctors` seeded into local state). Per-doctor and bulk-select status changes are local-only — never written to `doctor_day_statuses`, despite that table being the real backing store used by `/doctor/dashboard`'s own status control.
**API Calls:** None.

### /staff/walk-in
**Logic:** 3-step wizard (Patient→Slot→Confirm). Doctor list and day-status are real; patient search mixes real "quick registered this session" patients with `mockPatientSummaries`. Quick Register inserts a real guest patient. Booking creation computes a queue number via a count-then-format query (documented race condition, same pattern as the public booking wizard), inserts the booking (`Pending`, `PayAtClinic`, `is_walk_in:true`) and a companion `Unpaid` payment row.
**API Calls:**
- `doctors` — select w/ `staff_accounts(full_name,status)` — on mount
- `doctor_day_statuses` — select `(doctor_id,status)` — `.eq(status_date, today)` — on mount
- `patients` — insert (guest record) — on Register Patient
- `bookings` — select (count only) — `.eq(doctor_id).eq(appointment_date, today)` — on Create Booking (queue number calc)
- `bookings` — insert — on Create Booking
- `payments` — insert `{amount, status:'Unpaid'}` — on Create Booking

---

## Patient

### /patient/dashboard
**Logic:** Loads own patient record, all own bookings (joined doctor/services/payment), prescription count, up to 2 most-recent record/prescription items, and a doctor-browse carousel with live ratings. Shows unverified-email and needs-consent banners based on real fields — but their action buttons ("Resend Verification Email", "Review Now") have no handlers.
**API Calls:**
- `patients` — select `(first_name,is_email_verified,consented_at)` — `.eq(patient_id, own).single()` — on mount
- `bookings` — select w/ `doctors→staff_accounts`, `booking_services→services`, `payments` — `.eq(patient_id, own)` — on mount
- `prescription_groups` — select w/ `prescription_line_items`, `bookings→doctors→staff_accounts` — `.eq(patient_id, own)` — on mount
- `consultations` — select w/ `doctors→staff_accounts`, `bookings(appointment_date)` — `.eq(patient_id, own)` — on mount
- `doctors` — select w/ `staff_accounts(full_name,status)` — `.limit(6)` — on mount
- `v_doctor_ratings` — select `*` — on mount

### /patient/bookings
**Logic:** **Runs entirely on mock data** (`mockBookings`) — **not scoped to the signed-in patient at all**; shows every mock booking regardless of who's logged in. Tabs: All/Upcoming/For Payment/Completed/Cancelled.
**API Calls:** None.

### /patient/bookings/[id]
**Logic:** Loads one real booking by ID with **no ownership check against the signed-in patient** — any authenticated patient who knows/guesses a booking ID can view its full detail (doctor, services, amounts, payment status). Status-gated actions (Cancel, Submit Payment Proof) are **decorative — their modal buttons close the modal without writing anything**. "Leave a Review" link only appears when Completed; View/Print Receipt appears when Paid/Waived.
**API Calls:**
- `bookings` — select w/ `doctors→staff_accounts` — `.eq(booking_id).maybeSingle()` — on mount
- `booking_services` — select `(services(name))` — `.eq(booking_id)` — on mount
- `payments` — select `(status, waived_reason)` — `.eq(booking_id).maybeSingle()` — on mount

### /patient/doctors
**Logic:** Server component. Lists all non-Inactive doctors with live ratings and today's day-status. Specialization/sort dropdown filters are rendered but not wired (no `onChange`).
**API Calls:**
- `doctors` — select w/ `staff_accounts(full_name,status)` — on render
- `v_doctor_ratings` — select `*` — on render
- `doctor_day_statuses` — select `*` — `.eq(status_date, today)` — on render

### /patient/doctors/[id]
**Logic:** Server component. 404s if doctor missing or `staff_accounts.status === 'Inactive'`. Shows bio, services table, weekly schedule, and today's status. "Patient Reviews" section is hardcoded to "No reviews yet" regardless of the real `reviews` table content (never queried). "Book with {name}" links to `/booking?doctorId=`.
**API Calls:**
- `doctors` — select w/ `staff_accounts(full_name,status)` — `.eq(doctor_id).single()` — on render
- `doctor_services` — select w/ `services(name,category,price)` — `.eq(doctor_id)` — on render
- `doctor_schedules` — select — `.eq(doctor_id).order(day_of_week)` — on render
- `v_doctor_ratings` — select — `.eq(doctor_id).single()` — on render
- `doctor_day_statuses` — select `status` — `.eq(doctor_id).eq(status_date, today).maybeSingle()` — on render

### /patient/profile
**Logic:** 3 tabs (Info/Password/Consent). Info tab loads/edits the full patient record scoped to `session.patientId` and saves the editable subset of fields (email is read-only, "contact staff to update"). Consent tab is read-only, reflecting `consentedAt`/`consentVersion`. Password tab re-verifies current password before updating.
**API Calls:**
- `patients` — select `*` — `.eq(patient_id, own).single()` — on mount
- `patients` — update (demographics/contact/emergency/insurance fields) — `.eq(patient_id, own)` — on Save
- `auth.signInWithPassword` — verify current password — on Update Password
- `auth.updateUser` `{password}` — on Update Password

### /patient/reviews/[bookingId]
**Logic:** Loads the booking + checks whether a review already exists for it (schema enforces one review per booking). If not yet reviewed, shows a star-rating + comment form; submits with `patient_id` from the session (not the booking's own patient_id — no ownership check that the reviewer actually owns this booking).
**API Calls:**
- `bookings` — select `(booking_id,doctor_id,doctors→staff_accounts)` — `.eq(booking_id).single()` — on mount
- `reviews` — select `review_id` — `.eq(booking_id).maybeSingle()` — on mount
- `reviews` — insert `{booking_id,doctor_id,patient_id,rating,comment}` — on Submit Review

### /patient/privacy-consent
**Logic:** **Fully decorative** — checkbox must be checked to enable Submit, but Submit only does `router.push('/patient/dashboard')`. Never writes `patients.consented_at`, despite the dashboard's "Review Now" banner existing specifically because that field is checked.
**API Calls:** None.

### /patient/lab-results
**Logic:** **Runs entirely on mock data** (`mockLabResults`, `mockBookings`). Upload dropzone and "Upload" button have no handlers at all.
**API Calls:** None.

### /patient/medical-records
**Logic:** Loads own consultations with diagnoses and follow-ups, scoped to `session.patientId`. Client-side search across doctor/complaint/assessment. Expandable cards show full SOAP + follow-up. "Download All as PDF" button has no handler.
**API Calls:**
- `consultations` — select w/ `bookings(appointment_date)`, `doctors→staff_accounts`, `consultation_diagnoses`, `follow_ups` — `.eq(patient_id, own)` — on mount

### /patient/documents
**Logic:** **Runs entirely on mock data** (`mockDocuments`, `mockBookings`). Search resolves doctor name via the mock booking link. Upload dropzone/button have no handlers.
**API Calls:** None.

### /patient/prescriptions
**Logic:** Loads own prescription groups with line items and prescribing doctor, scoped to `session.patientId`. Client search. Print/download icon has no handler.
**API Calls:**
- `prescription_groups` — select w/ `prescription_line_items`, `bookings→doctors→staff_accounts` — `.eq(patient_id, own)` — on mount

### /patient/vaccinations
**Logic:** **Runs entirely on mock data** (`mockVaccinations`). Client search across vaccine/status/source/date. "Download PDF" button has no handler.
**API Calls:** None.

---

## Public (no role required)

### / (root)
**Logic:** Immediately `redirect("/login")`. No other behavior.
**API Calls:** None.

### /login
**Logic:** Email/password sign-in via Supabase Auth, then looks up `profiles.role` to route to the correct `/{role}/dashboard`. "Forgot password?" link is a dead anchor (`href="#"`). "Create an account" links to `/booking` (registration happens inside the booking wizard, not as a standalone signup page).
**API Calls:**
- `auth.signInWithPassword` — on submit
- `profiles` — select `role` — `.eq(id, user.id).single()` — on successful sign-in

### /logout
**Logic:** Server route handler (GET). Signs out and redirects to `/login`.
**API Calls:**
- `auth.signOut` — on request

### /booking
**Logic:** Public 6-step self-service wizard (Doctor→Date→Time→Review→Sign in→Payment). Loads all active doctors with services/schedules/blocked-dates up front. Step 5 performs either login or **self-service registration** (client-side `auth.signUp` + direct client insert into `profiles` with `role:'Patient'` and into `patients` — the only self-service account-creation path in the app; every other role is invite-only via server actions). Step 6 submits the booking: computes a queue number via count-then-format (documented race-condition tradeoff), inserts `bookings`, `booking_services`, and a companion `Unpaid` `payments` row, then redirects to the confirmation page.
**API Calls:**
- `doctors` — select w/ `staff_accounts(full_name,status)` — on mount
- `v_doctor_ratings` — select `*` — on mount
- `doctor_services` — select w/ `services(name,price)` — on mount
- `doctor_schedules` — select `*` — on mount
- `doctor_blocked_dates` — select `*` — on mount
- `auth.signInWithPassword` — Step 5, login mode
- `patients` — select `patient_id` — `.eq(user_id).single()` — Step 5, after login
- `auth.signUp` — Step 5, register mode
- `profiles` — insert `{id, role:'Patient'}` — Step 5, register mode (client-side, not a server action)
- `patients` — insert (real, non-guest record) — Step 5, register mode
- `bookings` — select (count only) — `.eq(doctor_id).eq(appointment_date)` — Step 6 submit (queue number calc)
- `bookings` — insert — Step 6 submit
- `booking_services` — insert (bulk) — Step 6 submit, if services selected
- `payments` — insert `{amount, status:'Unpaid'}` — Step 6 submit

### /booking/confirmation/[id]
**Logic:** Static confirmation screen. Reads `queue` from the query string only (no real fetch of the booking by `id` — the `id` param itself is unused). Links to My Bookings / Dashboard.
**API Calls:** None.

---

## Discrepancies / Unclear Areas

**Routes that render entirely from mock data (`src/data/mock.ts`), with zero Supabase calls, despite adjacent routes for the same role/data being fully real:**
- `/admin/patients/[id]`, `/admin/calendar`, `/admin/walk-in`, `/admin/announcements`, `/admin/reports`, `/admin/audit-logs`
- `/doctor/patients`, `/doctor/consultation/[bookingId]/vitals` (outer page only — the embedded `VitalsEditor` is real)
- `/staff/patients`, `/staff/patients/[id]`, `/staff/profile`, `/staff/announcements`, `/staff/payments`, `/staff/doctor-status`
- `/patient/bookings`, `/patient/lab-results`, `/patient/documents`, `/patient/vaccinations`

**Decorative UI — buttons/forms present with no handler or a handler that doesn't persist:**
- `/admin/walk-in` "Create Booking", `/admin/patients/[id]` "Save" (edit modal), `/patient/privacy-consent` "Submit" (never writes `consented_at`), `/patient/bookings/[id]` Cancel/Submit Payment Proof modals, `/patient/dashboard` "Resend Verification Email"/"Review Now" toasts, `/patient/lab-results` and `/patient/documents` upload buttons, `/patient/medical-records` "Download All as PDF", `/patient/prescriptions`/`/patient/vaccinations` download/print icons, `/staff/patients/[id]` "Create Account", `/staff/profile` Save/Update Password, `/patient/doctors` specialization/sort filters, `/login` "Forgot password?" link.

**Security/ownership gaps worth flagging explicitly:**
- `/patient/bookings/[id]` fetches any booking by ID with no check that it belongs to the signed-in patient's `patientId`.
- `/patient/reviews/[bookingId]` submits a review using the session's `patientId` with no check that the session's patient actually owns that booking.
- The public `/booking` registration step inserts directly into `profiles` (setting `role: 'Patient'`) from client-side code, rather than through a server action — every other role-assignment path in the app (`createDoctor`, `inviteStaffMember`) deliberately goes through a server action specifically to keep role assignment out of client reach. Several server actions' own comments note RLS is not yet enabled project-wide, which would make this gap currently exploitable (a client could in principle attempt to insert a different role) rather than just stylistically inconsistent.

**Data consistency / dead-write issues:**
- `audit_logs` is written to (consultation amend flow) but never read anywhere — `/admin/audit-logs` reads mock data instead.
- `/staff/dashboard` links to `/staff/bookings?filter=walkin`; `/staff/bookings` never reads a `filter` param.
- `/doctor/patients` shows the same `mockBookings[0]` as "Latest visit" for every patient card (not per-patient).
- `/doctor/appointments` and `/staff/bookings` both fetch `booking_services` and `payments` completely unfiltered (all doctors/all bookings) and match rows client-side by `booking_id` — functionally correct but sends more data to the client than necessary.
- `/patient/doctors/[id]` always renders "No reviews yet" under Patient Reviews regardless of actual `reviews` rows for that doctor.
- No UI route was found for Admin account creation itself — Admin accounts appear to require direct database seeding.
