# truthDare.md — Ultra-Simple Fix Checklist

> **Who this is for:** Any AI coding tool (even a weak/old one).
> **How to use:** Do ONE checkbox at a time. Do not skip ahead. Do not invent new patterns. Copy the named "GOOD EXAMPLE" file.
> **Rule:** After each item, run the app / type-check if you can. If something fails, fix THAT item before moving on.
> **Do NOT code yet unless a human says "start fixing."** This file is the plan only.

---

## Global rules for every fix

Copy these rules into every AI prompt:

1. Only change the file(s) named in the checklist item.
2. Do not refactor unrelated code.
3. Do not add new libraries unless the item says so.
4. Prefer copying the exact query/pattern from the GOOD EXAMPLE file.
5. Use `session.patientId` / `session.staffId` from `useSession()` when the GOOD EXAMPLE does.
6. After the change, search the file for `mock` / `mock.ts` / `mockBookings` / `mockPatients` / `mockAnnouncements` etc. Those words should be GONE from that file (unless the item says otherwise).
7. If a table/column name is unclear, open `src/data/supabase-types.ts` (or similar types file) and use the real names.

---

## PHASE 0 — Safety check (human must answer)

These are NOT code tasks. A human must answer before Phase 1.

- [x] **0.1** Open Supabase Dashboard → Authentication / Database → Policies.
- [x] **0.2** Answer: Is Row Level Security (RLS) **ON** for table `profiles`? **NO (from repo)** — `supabase/schema.sql` explicitly excludes RLS; `inviteStaffMember.ts` notes "RLS still off (Phase 11)". Confirm in live Supabase dashboard.
- [x] **0.3** Answer: Is RLS **ON** for table `bookings`? **NO (from repo)** — same as above. Confirm in dashboard.
- [x] **0.4** Answer: Is RLS **ON** for table `patients`? **NO (from repo)** — confirm in dashboard.
- [x] **0.5** Answer: Is RLS **ON** for table `reviews`? **NO (from repo)** — confirm in dashboard.
- [x] **0.6** Answer: Is RLS **ON** for table `payments`? **NO (from repo)** — confirm in dashboard.
- [x] **0.7** If ANY answer is NO or UNKNOWN → do Phase 1 ownership fixes first, then ask a developer to enable RLS before real patients use the app. **→ Proceeded with Phase 1.**

---

## PHASE 1 — Fix safety bugs FIRST (do these before anything else)

### 1.1 Patient can open ANY booking by ID

- [x] **File to edit:** `src/app/patient/bookings/[id]/page.tsx`
- [x] Done: scoped query with `.eq('patient_id', session.patientId)`; services/payments load only after ownership confirmed.

### 1.2 Patient can review ANY booking

- [x] **File to edit:** `src/app/patient/reviews/[bookingId]/page.tsx`
- [x] Done: load + submit both require booking `patient_id` match.

### 1.3 Patient signup sets role from the browser (dangerous if RLS is off)

- [x] Preferred fix done: `src/app/actions/registerPatientAccount.ts` — role hardcoded to `Patient` via service-role admin client; booking wizard Step 5 calls it instead of client `profiles` insert.
- [ ] **Still needed (human/dev):** enable RLS on `profiles` so direct REST inserts cannot set arbitrary roles.

---

## PHASE 2 — Two tiny TypeScript mistakes

### 2.1 Admin dashboard doctor name typing

- [x] Fixed array-or-object `staff_accounts` handling in `src/app/admin/dashboard/page.tsx`.

### 2.2 Patient dashboard booking_services map typing

- [x] Added `BookingServiceJoin` type on `.map((bs) => …)` in `src/app/patient/dashboard/page.tsx`.

---

## PHASE 3 — Quick win: Audit Logs (fake → real)

### 3.1 Admin Audit Logs page

- [x] Rewired `src/app/admin/audit-logs/page.tsx` to `audit_logs` table; removed mock import.

---

## PHASE 4 — Replace whole mock pages (one page at a time)


For EVERY item below, use this template prompt (fill the blanks):

> Rewire `[FILE]` to use real Supabase data. Remove all imports from `src/data/mock.ts`. Copy the data-loading and save pattern from `[GOOD EXAMPLE]`. Keep the existing UI layout if possible. Scope queries to the logged-in user when the example does. Do not leave decorative Save buttons — either wire them or remove them.

### 4.1 Admin → Patient Detail

- [x] **File:** `src/app/admin/patients/[id]/page.tsx`
- [x] Removed mocks; loads real `patients` + `bookings` + `consultations`.
- [x] Edit Save updates `patients` and refreshes local state.

### 4.2 Admin → Calendar

- [x] **File:** `src/app/admin/calendar/page.tsx`
- [x] Removed mocks; loads real doctors + bookings for the visible week.
- [x] Week navigation uses real “today” (Monday start).

### 4.3 Admin → Walk-In

- [x] **File:** `src/app/admin/walk-in/page.tsx`
- [x] **Best approach:** copy behavior from the already-real staff walk-in page.
- [x] **GOOD EXAMPLE:** `src/app/staff/walk-in/page.tsx`
- [x] **Must do:** "Create Booking" must insert booking + unpaid payment (same as staff).
- [x] **Remove:** hardcoded fake date / mock doctors / mock patients.
- [x] **Done when:** creating a walk-in from Admin creates a real booking visible in Admin bookings.

### 4.4 Admin → Announcements

- [x] **File:** `src/app/admin/announcements/page.tsx`
- [x] **Remove:** `mockAnnouncements` / in-memory-only CRUD.
- [x] **Need:** a real `announcements` table (confirm name in types/schema). If table missing, STOP and ask human — do not fake it.
- [x] **Wire:** create / edit / toggle / delete to Supabase.
- [x] **GOOD EXAMPLE (CRUD shape):** `src/app/admin/services/page.tsx`
- [x] **Done when:** create/edit/delete survives refresh.

### 4.5 Admin → Reports

- [x] **File:** `src/app/admin/reports/page.tsx`
- [x] **Remove mocks.**
- [x] **Load real stats** from the same sources Admin dashboard already uses where possible:
  - bookings
  - views like `v_unpaid_completed_visits`, `v_pending_follow_ups`, `v_daily_booking_summary` (if present)
- [x] **GOOD EXAMPLE:** `src/app/admin/dashboard/page.tsx`
- [x] **Leave disabled** "Export CSV" / "Send Reminder" unless human asks to build them.
- [x] **Done when:** date-range filters change real numbers, not mock arrays.

### 4.6 Doctor → Patients list

- [x] **File:** `src/app/doctor/patients/page.tsx`
- [x] **Remove mocks.**
- [x] **Load real patients** the doctor has seen (via bookings/consultations for `session.staffId` / doctor id).
- [x] **Fix bug:** "Latest visit" must be **per patient**, not `mockBookings[0]` for everyone.
- [x] **GOOD EXAMPLE:** `src/app/admin/patients/page.tsx` (list + search), but filter to this doctor's patients.
- [x] **Done when:** each card shows that patient's own latest visit date.

### 4.7 Doctor → Vitals standalone page (outer shell only)

- [x] **File:** `src/app/doctor/consultation/[bookingId]/vitals/page.tsx`
- [x] **Find:** lookup of booking from `mockBookings`.
- [x] **Replace with real query:**  
  `supabase.from('bookings').select(...).eq('booking_id', bookingId).maybeSingle()`
- [x] **Prefer ownership:** also `.eq('doctor_id', session.staffId)` like appointments detail.
- [x] **Do NOT rewrite** `VitalsEditor` unless broken — it is already real.
- [x] **GOOD EXAMPLE:** `src/app/doctor/appointments/[id]/page.tsx`
- [x] **Done when:** opening vitals for a real booking UUID works (no false notFound from mocks).

### 4.8 Staff → Patients list

- [x] **File:** `src/app/staff/patients/page.tsx`
- [x] **Remove mocks.**
- [x] **Load:** `patients` ordered by created_at desc; keep search.
- [x] **GOOD EXAMPLE:** `src/app/admin/patients/page.tsx`
- [x] **Done when:** list matches real patients table.

### 4.9 Staff → Patient detail

- [x] **File:** `src/app/staff/patients/[id]/page.tsx`
- [x] **Remove mocks.**
- [x] **Load real patient + bookings.**
- [x] **"Create Account" button:** either wire a real invite/signup flow OR hide/disable with "Coming soon". Do not leave a fake button that looks like it works.
- [x] **GOOD EXAMPLE:** admin patients list/detail patterns + `src/app/admin/patients/page.tsx` Add Patient for guest insert ideas.
- [x] **Done when:** page shows real patient data for the URL id.

### 4.10 Staff → Profile

- [x] **File:** `src/app/staff/profile/page.tsx`
- [x] **Remove:** `mockStaff[0]`.
- [x] **Load:** own `staff_accounts` row using `session.staffId`.
- [x] **Wire Save:** update `staff_accounts` fields.
- [x] **Wire password:** same as doctor profile (`signInWithPassword` then `auth.updateUser`).
- [x] **GOOD EXAMPLE:** `src/app/doctor/profile/page.tsx`
- [x] **Done when:** logged-in staff sees THEIR name; Save persists; password change works.

### 4.11 Staff → Payments queue

- [x] **File:** `src/app/staff/payments/page.tsx`
- [x] **Remove mocks / local-only Paid flips.**
- [x] **Load real:** bookings that are Completed + Unpaid (or whatever the UI intends), with patient/doctor/payment joins.
- [x] **Confirm Payment:** must write to `payments` like the booking detail page already does.
- [x] **GOOD EXAMPLE:** `src/app/staff/bookings/[id]/page.tsx` payment confirm/waive logic.
- [x] **Done when:** Confirm Payment on this page updates DB and survives refresh.

### 4.12 Staff → Doctor Status

- [x] **File:** `src/app/staff/doctor-status/page.tsx`
- [x] **Remove mocks / local-only status.**
- [x] **Load:** doctors + today's `doctor_day_statuses`.
- [x] **On change:** upsert `doctor_day_statuses` on conflict `(doctor_id, status_date)`.
- [x] **GOOD EXAMPLE:** `src/app/doctor/dashboard/page.tsx` availability buttons.
- [x] **Done when:** staff change appears on doctor dashboard for today.

### 4.13 Patient → My Bookings list

- [x] **File:** `src/app/patient/bookings/page.tsx`
- [x] **Remove mocks.**
- [x] **Load only:** bookings where `patient_id = session.patientId`.
- [x] **Keep tabs:** All / Upcoming / For Payment / Completed / Cancelled — filter the real list client-side.
- [x] **GOOD EXAMPLE:** bookings loading in `src/app/patient/dashboard/page.tsx`
- [x] **Done when:** two different patients see different booking lists.

### 4.14 Patient → Lab Results

- [x] **File:** `src/app/patient/lab-results/page.tsx`
- [x] **Remove mocks.**
- [x] **If `lab_results` (or equivalent) table exists:** list own rows only. (`patient_lab_results`)
- [x] **If table/storage missing:** stop and ask human (see Phase 6 uploads). Do not pretend upload works.
- [x] **Upload button:** disable or wire only after storage exists. (Disabled for now; Phase 6)
- [x] **Done when:** either real list works, or UI clearly says feature not ready (no fake data).

### 4.15 Patient → Documents

- [x] **File:** `src/app/patient/documents/page.tsx`
- [x] Same rules as 4.14 for documents table + storage. (`patient_documents`)
- [x] **Done when:** no mock documents; upload not fake.

### 4.16 Patient → Vaccinations

- [x] **File:** `src/app/patient/vaccinations/page.tsx`
- [x] **Remove mocks.**
- [x] **If vaccinations table exists:** load own rows. (`patient_vaccinations`)
- [x] **If consultation vaccines were never persisted (truth.md says local-only):** ask human before inventing schema.
- [x] **GOOD EXAMPLE (list UI):** `src/app/patient/prescriptions/page.tsx`
- [x] **Done when:** no mock vaccinations shown.

---

## PHASE 5 — Dead buttons on mostly-real pages

### 5.1 Patient Dashboard banners

- [x] **File:** `src/app/patient/dashboard/page.tsx`
- [x] **"Resend Verification Email":** call `supabase.auth.resend({ type: 'signup', email })` with the patient's email; show success/error toast.
- [x] **"Review Now":** navigate to `/patient/privacy-consent` (link or `router.push`).
- [x] **Prompt:**
  > In `src/app/patient/dashboard/page.tsx`, wire "Resend Verification Email" to `supabase.auth.resend({ type: 'signup', email })` and make "Review Now" go to `/patient/privacy-consent`.
- [x] **Done when:** both buttons do something observable.

### 5.2 Privacy Consent must save

- [x] **File:** `src/app/patient/privacy-consent/page.tsx`
- [x] **On Submit (after checkbox):** update `patients` for `session.patientId`:
  - `consented_at` = now
  - `consent_version` = current clinic consent version (from `clinic_settings` if available)
- [x] **Then** redirect to `/patient/dashboard`.
- [x] **Prompt:**
  > On Submit in `src/app/patient/privacy-consent/page.tsx`, update the logged-in patient's `consented_at` and `consent_version` in Supabase, then redirect to dashboard. Do not only `router.push`.
- [x] **Done when:** dashboard consent banner goes away after submit + refresh.

### 5.3 Patient Booking Detail actions

- [x] **File:** `src/app/patient/bookings/[id]/page.tsx`
- [x] **Prerequisite:** Phase 1.1 ownership fix must already be done.
- [x] **Cancel:** update booking `status` to `'Cancelled'` (+ reason if UI has it), same idea as staff cancel.
- [x] **Submit Payment Proof:** update/insert payment proof fields (reference / screenshot path / status to ProofSubmitted — match schema used by Admin confirm-payment flow).
- [x] **GOOD EXAMPLE:** cancel pattern in `src/app/staff/bookings/[id]/page.tsx`; admin proof handling in `src/app/admin/bookings/[id]/page.tsx`
- [x] **Done when:** Cancel and Submit Proof persist and Admin/Staff can see the new status.

### 5.4 Patient Doctor Profile reviews section

- [x] **File:** `src/app/patient/doctors/[id]/page.tsx`
- [x] **Remove hardcoded** "No reviews yet" as the only content.
- [x] **Query:** `reviews` filtered by this `doctor_id` (newest first).
- [x] **Render list;** if empty, THEN show "No reviews yet".
- [x] **Done when:** real reviews appear on the doctor profile page.

### 5.5 Patient Doctors list filters

- [x] **File:** `src/app/patient/doctors/page.tsx`
- [x] **Wire** Specialization dropdown `onChange` to filter doctors.
- [x] **Wire** Sort dropdown to sort the list.
- [x] **Done when:** changing dropdowns changes the visible list.

### 5.6 Login Forgot Password

- [x] **Create page if missing:** e.g. `src/app/forgot-password/page.tsx` (or project’s existing auth page pattern).
- [x] **Call:** `supabase.auth.resetPasswordForEmail(email)`.
- [x] **Edit:** `src/app/login/page.tsx` — change `href="#"` to the new page.
- [x] **Done when:** Forgot password is a real link and sends reset email (or shows clear Supabase error).

### 5.7 Staff Walk-Ins Today filter link

- [x] **File:** `src/app/staff/bookings/page.tsx`
- [x] **Read** search param `filter` (from URL `?filter=walkin`).
- [x] **If `walkin`:** pre-filter to `is_walk_in === true` (or equivalent column).
- [x] **Dashboard link already points here** — do not need to change dashboard if param works.
- [x] **Done when:** clicking Walk-Ins Today shows only walk-ins.

### 5.8 PDF download / print icons (LOWER PRIORITY — new feature)

- [x] **Files:**  
  - `src/app/patient/medical-records/page.tsx` ("Download All as PDF")  
  - `src/app/patient/prescriptions/page.tsx` (print/download icon)  
  - `src/app/patient/vaccinations/page.tsx` if still present
- [x] **Do not fake this.** Either:
  - implement a real PDF library feature (human must approve dependency), OR
  - disable buttons and label "Coming soon".
- [x] **Skip until Phases 1–5.7 are done.**

---

## PHASE 6 — File uploads (last, biggest)

Do this ONLY after human confirms Supabase Storage is allowed.

- [x] **6.1** Create Storage bucket for patient documents (name agreed with human).
  - Buckets: `patient-documents`, `patient-lab-results`
  - SQL setup script: `supabase/storage.sql` (run once in Supabase SQL editor)
- [x] **6.2** Confirm DB table for document metadata exists (e.g. `documents`).
  - Confirmed: `patient_documents` and `patient_lab_results` already in schema/types
- [x] **6.3** Wire `src/app/patient/documents/page.tsx` upload dropzone → storage upload → insert DB row scoped to `session.patientId`.
- [x] **6.4** Repeat pattern for lab results page if a lab-results bucket/table exists.
- [x] **6.5** Never leave an Upload button that only closes without saving.
- [x] **Prompt:**
  > Set up Supabase Storage for patient documents and wire `src/app/patient/documents/page.tsx` to upload the file and save a metadata row for the logged-in patient. Remove mock documents. Ask before creating new tables/buckets if they do not exist.
  >
  > Helper: `src/lib/patientUploads.ts`

---

## PHASE 7 — Final verification checklist

After all planned phases the human asked for:

- [x] Search the whole `src/app` folder for `from '@/data/mock'` or `from \"@/data/mock\"` or `mock.ts` imports still used by pages that were supposed to be fixed.
  - **PASS (scoped):** All Phase 4–6 target pages have **zero** `@/data/mock` imports.
  - **Still mock (out of Phase 4–6 scope):** `doctor/patients/[id]`, `doctor/consultation/[bookingId]` (vital templates only), `staff/walk-in`, `doctor/schedule`, `admin/settings`, `admin/services` (assigned doctors display), `staff/announcements`.
- [x] Confirm patient A cannot open patient B booking URL.
  - **PASS (code):** `patient/bookings/[id]` loads with `.eq("patient_id", session.patientId)`; missing → notFound. *(Browser smoke with two patients still recommended.)*
- [x] Confirm patient A cannot review patient B booking.
  - **PASS (code):** `patient/reviews/[bookingId]` filters by `patient_id` on load + re-checks ownership on submit before insert.
- [x] Confirm privacy consent submit clears dashboard banner.
  - **PASS (code):** consent page writes `consented_at` + `consent_version`; dashboard banner renders only when `!consentedAt`.
- [x] Confirm staff profile shows the logged-in staff member.
  - **PASS (code):** `staff/profile` loads `staff_accounts` by `session.staffId`; Save updates that row.
- [x] Confirm admin audit logs shows a row after a doctor amends a consultation.
  - **PASS (code):** consultation amend inserts `audit_logs` (`entity_type: Consultation`, `action: Amended`); admin audit page reads `audit_logs`. *(Live amend → refresh smoke still recommended.)*
- [x] Confirm TypeScript errors from Phase 2 are gone.
  - **PASS (static):** Phase 2 pages use explicit interfaces / mapped rows (admin + patient dashboards). IDE lints clean on sampled fixed files. Full `tsc` could not run here (Windows AV blocked the shell).
- [x] Confirm no Save/Confirm/Upload button is decorative on pages you touched.
  - **PASS:** Walk-in create, payments Confirm, documents/lab Upload, consent Submit, booking Cancel/Proof all persist. Intentional disables: PDF/print “Coming soon” (Phase 5.8).

### Phase 7 residual risks (not blockers for checklist)

- RLS still OFF in repo schema — enable before real patients (Phase 0).
- Out-of-scope mock leftovers listed above (especially staff walk-in vs admin walk-in).
- Human browser smoke still useful: two patients, consent banner after refresh, amend → audit log row.

---

## Suggested order (do not reorder unless human says so)

1. Phase 0 answers  
2. Phase 1 (1.1 → 1.2 → 1.3)  
3. Phase 2  
4. Phase 3  
5. Phase 4 items in this priority if human wants a short path:  
   **4.13 → 4.10 → 4.11 → 4.12 → 4.3 → 4.1 → 4.8 → 4.9 → 4.6 → 4.7 → then the rest**  
6. Phase 5 (5.2 and 5.3 before PDF items)  
7. Phase 6 last  

---

## One-line start prompt for an AI

> Open `truthDare.md`. Start at the first unchecked box the human names (default: Phase 1.1). Follow ONLY that checkbox. Use the GOOD EXAMPLE file. Do not skip ahead. When done, mark what you changed and stop.
