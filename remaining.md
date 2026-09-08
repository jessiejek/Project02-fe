# Remaining work (after Phases 1–7)

Phases 1–7 in `truthDare.md` are done. This file tracks **leftover** items that were out of those phases.

Use the same rules as `truthDare.md`: one checkbox at a time, real Supabase only, no decorative Save/Confirm/Upload buttons.

---

## A — Still on mocks (wire to Supabase)

### A.1 Staff → Walk-in

- [x] **File:** `src/app/staff/walk-in/page.tsx`
- [x] **Remove:** `mockPatientSummaries` (and any other mock imports).
- [x] **Match:** admin walk-in (`src/app/admin/walk-in/page.tsx`) — real patients/doctors, create booking + unpaid payment.
- [x] **Done when:** search/create uses DB; refresh shows the new booking.
  - Also: Print Queue Slip disabled “Coming soon” (was decorative).

### A.2 Doctor → Patient chart detail

- [x] **File:** `src/app/doctor/patients/[id]/page.tsx`
- [x] **Remove:** mock imports for bookings / labs / docs / vaccinations tabs.
- [x] **Load real:** patient row + that doctor's related bookings; labs/docs/vax from real tables scoped to patient (and doctor ownership where required).
- [x] **Done when:** URL id shows real data; no mock lists in any tab.
  - Bookings/consultations/prescriptions scoped to logged-in doctor; labs/docs/vax/vitals by patient; templates from `vital_field_templates`.

### A.3 Doctor → Consultation (vital templates)

- [x] **File:** `src/app/doctor/consultation/[bookingId]/page.tsx`
- [x] **Remove:** `mockVitalFieldTemplates` dependency.
- [x] **Replace with:** real vital field source (clinic settings / template table / hard-coded clinic list agreed with human — ask before inventing schema).
- [x] **Done when:** vitals UI does not import `@/data/mock`.
  - Also cleared mock seed in `src/components/doctor/VitalsEditor.tsx` — both load `vital_field_templates`.

### A.4 Doctor → Schedule (affected booking count)

- [x] **File:** `src/app/doctor/schedule/page.tsx`
- [x] **Remove:** `mockBookings` usage for counts.
- [x] **Load real:** this doctor's bookings for the relevant date/range.
- [x] **Done when:** “affected” / count numbers match DB.
  - Counts non-cancelled bookings for `doctor_id` + selected `appointment_date` when adding a blocked date.

### A.5 Admin → Settings

- [x] **File:** `src/app/admin/settings/page.tsx`
- [x] **Remove:** `mockSettings`, `mockOperatingHours`.
- [x] **Load/save:** `clinic_settings` (+ operating hours table if it exists).
- [x] **Done when:** Save persists and survives refresh.
  - Was already wired to DB; only mock initial-state seeds remained — replaced with empty/default placeholders until load.

### A.6 Admin → Services (Assigned Doctors display)

- [x] **File:** `src/app/admin/services/page.tsx`
- [x] **Remove:** `mockDoctors` for assigned-doctors display (keep real services load if already wired).
- [x] **Load real:** doctor ↔ service links from DB.
- [x] **Done when:** assigned doctors list matches DB, not mock.
  - Loads/saves `doctor_services` (duration from doctor `slot_duration_minutes`).

### A.7 Staff → Announcements

- [x] **File:** `src/app/staff/announcements/page.tsx`
- [x] **Remove:** `mockAnnouncements`.
- [x] **Load real:** `announcements` (read-only for staff is OK if that is the product rule).
- [x] **GOOD EXAMPLE:** `src/app/admin/announcements/page.tsx`
- [x] **Done when:** staff see the same real announcements as admin (per role rules).
  - Staff view shows **active only**; poster name resolved via `staff_accounts.user_id` when `posted_by_user_id` is set.

---

## B — Production / safety leftovers

### B.1 Row Level Security

- [x] **Enable RLS** on patient-facing tables before real patient data.
- [x] **Add policies** so patients only read/write their own rows; staff/doctors scoped by role.
- [x] **Note:** repo `supabase/schema.sql` still has RLS off — treat as blocking for production.
  - **Deliverable:** `supabase/rls.sql` — run once in Supabase SQL editor (same pattern as `storage.sql`).
  - Helpers: `current_patient_id()`, `is_staff_like()`, `is_admin()`, `owns_booking()`.
  - Patients scoped to own rows; Staff/Doctor/Admin clinic-wide; anon can read doctor catalog for `/booking`.
  - `profiles` insert/update blocked for clients (service-role actions only).
  - Views set `security_invoker = true` so RLS applies.
  - **You must run this SQL in the live project** before treating production as safe.

### B.2 PDF / print (optional product)

- [x] Medical records “Download All as PDF”
- [x] Prescriptions print/download
- [x] Vaccinations PDF
- [x] **Rule:** implement with an approved PDF library, or leave disabled “Coming soon” (current state).
  - **Chosen:** keep disabled “Coming soon” (no PDF library approved). Revisit when you name an allowed package.

---

## C — Manual smoke tests (browser)

Do these **after** `rls.sql` is applied (you ran it). Use real accounts in the browser.

**How:** `npm run dev` → http://localhost:3000 → `/login`. Paste any error text / screenshot if something fails after RLS.

### Prep
- [ ] Dev server running
- [ ] Two patient accounts (A and B) with at least one booking each
- [ ] One staff, one doctor, one admin account

### Ownership / privacy
- [ ] **C.1** As Patient A, open Patient B’s booking URL `/patient/bookings/{B-booking-id}` → expect not found / empty / redirect (not B’s data).
- [ ] **C.2** As Patient A, open `/patient/reviews/{B-booking-id}` → cannot submit a review for B.
- [ ] **C.3** As Patient A and Patient B, open `/patient/bookings` → lists are different.

### Consent / profile
- [ ] **C.4** As a patient with no consent: submit `/patient/privacy-consent` → refresh dashboard → consent banner gone.
- [ ] **C.5** As staff: `/staff/profile` shows **that** staff member’s name (not a hardcoded person).

### Writes survive refresh
- [ ] **C.6** Doctor amends a consultation → Admin `/admin/audit-logs` shows a new Amended row.
- [ ] **C.7** Staff Confirm Payment on `/staff/payments` → refresh → still Paid.
- [ ] **C.8** Patient Upload Document on `/patient/documents` → refresh → file still listed.

### Post-RLS quick health (extra)
- [ ] **C.9** Public `/booking` still lists doctors (anon catalog read).
- [ ] **C.10** Staff walk-in create booking still works.
- [ ] **C.11** Login still routes Patient/Staff/Doctor/Admin to the right dashboard.

---

## Suggested order

1. **A.1** Staff walk-in (parity with admin)  
2. **A.7** Staff announcements (small)  
3. **A.4** Doctor schedule counts  
4. **A.6** Admin services doctors display  
5. **A.5** Admin settings  
6. **A.2** Doctor patient chart  
7. **A.3** Consultation vital templates (may need human decision on data source)  
8. **C** smoke tests anytime on fixed pages  
9. **B.1** RLS before production  
10. **B.2** PDF only if human asks  

---

## One-line start prompt

> Open `remaining.md`. Start at the first unchecked box I name (default: A.1). Follow ONLY that checkbox. Use the GOOD EXAMPLE if listed. Mark done when finished and stop.
