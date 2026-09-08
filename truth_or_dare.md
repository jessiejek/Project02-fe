# truth_or_dare.md — What's Broken and How to Fix It

## Read this first (important, honest notes)

1. This is Supabase + Next.js. Yes, it should be easy to check.
2. I did NOT click every button in a browser. I read every file's code very carefully instead. That tells us what the code *will* do, which is 99% as good as clicking — but it is not the exact same as testing.
3. I DID run a type-check on the whole project (a command that checks for coding mistakes). Good news: **only 2 small mistakes found out of ~44 pages.** That means the app is built solidly. The problems below are not "broken code" — they are "pages that were never connected to the real database yet," or "buttons that don't do anything yet."
4. I could not run the full "build" test because my sandbox has no internet to download a font. That is not a bug in your project — it's my environment. Not something to worry about.

---

## Part 1: The 2 real code mistakes (small, easy fixes)

### Mistake 1 — Admin Dashboard doctor list
**File:** `src/app/admin/dashboard/page.tsx`, near line 96
**What's wrong:** The code assumes a doctor's info comes back as one single record, but Supabase is sending it back as a list (with square brackets `[ ]`) with one item inside. Reading `.full_name` directly off a list confuses the type-checker.
**How to fix it — tell your AI coding tool:**
> "In `src/app/admin/dashboard/page.tsx`, the line that reads `d.staff_accounts?.full_name` needs to handle `staff_accounts` being an array. Do the same array-or-object check used elsewhere in this file (see how `doctors` is handled in `booking/page.tsx`) before reading `full_name`."

### Mistake 2 — Patient Dashboard bookings list
**File:** `src/app/patient/dashboard/page.tsx`, near line 88
**What's wrong:** One part of the code loops through a list (`booking_services`) but never says what type of thing is inside the list. TypeScript doesn't know, so it complains.
**How to fix it — tell your AI coding tool:**
> "In `src/app/patient/dashboard/page.tsx`, the `.map((bs) => ...)` call around line 88 needs a type on `bs`. Add the correct type for a `booking_services` row (check `src/data/supabase-types.ts` for the right type name) so TypeScript stops complaining."

These 2 are small. They will not stop the app from running. Fix them whenever — not urgent.

---

## Part 2: Pages that are NOT connected to the real database yet

These pages look finished. But they are still showing **fake/pretend data** (the code calls this "mock data"). Nothing you do on these pages gets saved. If a teammate thinks these are "done," they are not.

For every page below, the fix is the same shape. Tell your AI coding tool something like:
> "Rewire `[FILE PATH]` to use real Supabase data instead of the mock data in `src/data/mock.ts`. Look at how `[A WORKING EXAMPLE PAGE]` does it for the same pattern."

I've given you the exact file and a matching real example to copy from, for each one.

| # | Page (URL) | File | What's fake | Copy the pattern from this REAL page |
|---|---|---|---|---|
| 1 | Admin → Patient Detail | `src/app/admin/patients/[id]/page.tsx` | Whole page. Edit button doesn't save. | `src/app/patient/profile/page.tsx` (real edit+save pattern) |
| 2 | Admin → Calendar | `src/app/admin/calendar/page.tsx` | Whole page, view-only | `src/app/doctor/schedule/page.tsx` |
| 3 | Admin → Walk-In | `src/app/admin/walk-in/page.tsx` | Whole page. "Create Booking" button does nothing at all. | `src/app/staff/walk-in/page.tsx` (this one is REAL and does the same job — just copy it into the admin folder) |
| 4 | Admin → Announcements | `src/app/admin/announcements/page.tsx` | Whole page. Add/Edit/Delete don't save. | `src/app/admin/services/page.tsx` (same add/edit/delete pattern, already real) |
| 5 | Admin → Reports | `src/app/admin/reports/page.tsx` | Whole page | `src/app/admin/dashboard/page.tsx` (similar stats-loading pattern) |
| 6 | Admin → Audit Logs | `src/app/admin/audit-logs/page.tsx` | Whole page. Real audit log entries ARE being saved elsewhere — this page just isn't reading them. | See "Part 4" below — this one's a quick fix |
| 7 | Doctor → Patients List | `src/app/doctor/patients/page.tsx` | Whole page. Also shows the SAME "last visit" for every patient (a bug) | `src/app/admin/patients/page.tsx` |
| 8 | Doctor → Vitals page | `src/app/doctor/consultation/[bookingId]/vitals/page.tsx` | The outer page looks up the visit from fake data, so it will show "not found" for every real visit. The vitals form inside it IS real and works fine. | Fix is small — see Part 3, item 3 |
| 9 | Staff → Patients List | `src/app/staff/patients/page.tsx` | Whole page | `src/app/admin/patients/page.tsx` |
| 10 | Staff → Patient Detail | `src/app/staff/patients/[id]/page.tsx` | Whole page. "Create Account" button does nothing. | `src/app/admin/patients/page.tsx`'s Add Patient form |
| 11 | Staff → My Profile | `src/app/staff/profile/page.tsx` | Whole page. Doesn't even know who is logged in — shows the same fake person no matter who signs in. Save button does nothing. | `src/app/doctor/profile/page.tsx` |
| 12 | Staff → Payments Queue | `src/app/staff/payments/page.tsx` | Whole page. "Confirm Payment" only pretends — closes and forgets. | `src/app/staff/bookings/[id]/page.tsx` (this one has REAL payment confirming already) |
| 13 | Staff → Doctor Status | `src/app/staff/doctor-status/page.tsx` | Whole page. Status changes don't save. | `src/app/doctor/dashboard/page.tsx` (has the real save-to-database version of this same status control) |
| 14 | Patient → My Bookings | `src/app/patient/bookings/page.tsx` | Whole page. Shows the SAME bookings to every patient, no matter who is logged in. | `src/app/patient/dashboard/page.tsx` (loads bookings for the real logged-in patient) |
| 15 | Patient → Lab Results | `src/app/patient/lab-results/page.tsx` | Whole page. Upload button does nothing. | See Part 4 (file upload note) |
| 16 | Patient → My Documents | `src/app/patient/documents/page.tsx` | Whole page. Upload button does nothing. | See Part 4 |
| 17 | Patient → Vaccinations | `src/app/patient/vaccinations/page.tsx` | Whole page | `src/app/patient/prescriptions/page.tsx` (same list pattern, real) |

---

## Part 3: Buttons that look real but do nothing (small, page mostly works)

For each of these, the page IS connected to real data — only this one button is fake.

1. **Patient Dashboard** (`src/app/patient/dashboard/page.tsx`) — "Resend Verification Email" and "Review Now" buttons do nothing.
   **Fix:** Tell your AI tool: *"Wire up the 'Resend Verification Email' button to call `supabase.auth.resend({type:'signup', email})`, and make 'Review Now' link to `/patient/privacy-consent`."*

2. **Patient Privacy Consent** (`src/app/patient/privacy-consent/page.tsx`) — Submit button just leaves the page. It never actually records "yes, I agree" anywhere.
   **Fix:** *"On Submit in `src/app/patient/privacy-consent/page.tsx`, update the patients table: set `consented_at` to right now and `consent_version` to the current version, for the logged-in patient, before redirecting."* — This one matters because the Dashboard nags patients to do this and it currently can never actually go away.

3. **Doctor Vitals page** (`src/app/doctor/consultation/[bookingId]/vitals/page.tsx`) — looks up the visit from fake data. Real visits will always show "not found."
   **Fix:** *"In this file, replace the fake-data lookup of `booking` with a real Supabase query: `supabase.from('bookings').select('*').eq('booking_id', bookingId).maybeSingle()`, same as `src/app/doctor/appointments/[id]/page.tsx` does it."*

4. **Patient Booking Detail** (`src/app/patient/bookings/[id]/page.tsx`) — "Cancel Booking" and "Submit Payment Proof" buttons open a confirm box, but pressing confirm does nothing — no save happens.
   **Fix:** *"Wire up Cancel to update the booking's status to 'Cancelled', and Submit Payment Proof to insert the reference number and screenshot into the payments table, in `src/app/patient/bookings/[id]/page.tsx`. Copy the pattern already used for Cancel in `src/app/staff/bookings/[id]/page.tsx`."*

5. **Patient Doctor Profile** (`src/app/patient/doctors/[id]/page.tsx`) — Always says "No reviews yet," even when there are real reviews.
   **Fix:** *"In this file, add a query to the `reviews` table filtered by this doctor, and show the real list instead of the hardcoded 'No reviews yet' text."*

6. **Patient Medical Records** (`src/app/patient/medical-records/page.tsx`) — "Download All as PDF" does nothing.
7. **Patient Prescriptions** (`src/app/patient/prescriptions/page.tsx`) — the print/download icon does nothing.
   **Fix for both 6 and 7:** These need a PDF-generation feature that doesn't exist yet anywhere in the app. This is a **new feature to build**, not a quick fix. Lower priority than the others.

8. **Patient Doctors List** (`src/app/patient/doctors/page.tsx`) — the "Specialization" and "Sort" dropdowns don't do anything when you pick an option.
   **Fix:** *"Wire up the specialization filter and sort dropdown in `src/app/patient/doctors/page.tsx` to actually filter/sort the `doctors` list on change."*

9. **Login Page** (`src/app/login/page.tsx`) — "Forgot password?" link goes nowhere (`href="#"`).
   **Fix:** *"Build a real 'forgot password' page that calls `supabase.auth.resetPasswordForEmail(email)`, and link the 'Forgot password?' text on the login page to it."*

10. **Staff Dashboard link** (`src/app/staff/dashboard/page.tsx`) — the "Walk-Ins Today" box links to `/staff/bookings?filter=walkin`, but the bookings page never reads that filter, so it just shows everything.
    **Fix:** *"In `src/app/staff/bookings/page.tsx`, read the `filter` URL parameter, and if it equals `walkin`, pre-set the filter to only show walk-in bookings."*

---

## Part 4: Quick wins

1. **Audit Logs page shows nothing real** (`src/app/admin/audit-logs/page.tsx`) — Good news: the real database table (`audit_logs`) is already being written to correctly (it happens automatically when a doctor edits a finished visit). This page just needs to read from it instead of fake data.
   **Fix:** *"In `src/app/admin/audit-logs/page.tsx`, replace the mock data with a real query: `supabase.from('audit_logs').select('*').order('created_at', {ascending:false})`."*

2. **File uploads (lab results, documents)** — none of the "drop a file here" boxes anywhere in the app actually upload a file. This needs Supabase Storage set up (a place to keep the files), which doesn't look configured yet.
   **Fix:** This is a bigger job — new feature, not a bug. Ask your AI tool: *"Set up a Supabase Storage bucket for patient documents, and wire the upload box in `src/app/patient/documents/page.tsx` to actually upload the file there and save a record in the `documents` table."*

---

## Part 5: Safety problems (fix these FIRST, before anything else)

These are more serious than "missing feature" — these are places where the app could let someone see or do something they shouldn't.

1. **Any patient can view any other patient's booking** by typing a different ID in the address bar.
   **File:** `src/app/patient/bookings/[id]/page.tsx`
   **Fix:** *"In `src/app/patient/bookings/[id]/page.tsx`, add `.eq('patient_id', session.patientId)` to the booking query, so a patient can only ever load their own bookings."*

2. **Any patient can post a review under any booking**, even one that isn't theirs.
   **File:** `src/app/patient/reviews/[bookingId]/page.tsx`
   **Fix:** *"In `src/app/patient/reviews/[bookingId]/page.tsx`, check that the booking's `patient_id` matches the logged-in patient's ID before allowing the review form to show."*

3. **New patient sign-ups set their own account role directly**, instead of going through a safe, locked-down process like every other role in this app does.
   **File:** `src/app/booking/page.tsx` (the sign-up part of the booking wizard)
   **Fix:** This is the most important one to ask a real developer or your AI tool to look at carefully — say: *"Patient registration in `src/app/booking/page.tsx` inserts directly into the `profiles` table from the browser, setting role to 'Patient'. Every other role (Staff, Doctor, Admin) is created through a safe server action instead. Please check whether Row Level Security (RLS) is turned on for the `profiles` table in Supabase — if it's not turned on, this is unsafe right now. Turn on RLS so a person can never set their own role to Staff/Doctor/Admin from the browser."*

**This one needs a direct answer from you: is Row Level Security turned ON in your Supabase project's dashboard, for every table?** I could not check this from the code alone — it's a setting inside Supabase, not something visible in your files. If you're not sure, that's the very next thing to check, before showing this app to real patients.

---

## Summary — what to do, in order

1. **Check Supabase dashboard → Authentication → Policies. Is RLS ON for every table?** (Part 5 — can't be skipped)
2. Fix the 2 patient-booking-ownership gaps (Part 5, items 1 & 2)
3. Fix the 2 small type errors (Part 1) — quick, no rush
4. Wire up the "quick win" audit log page (Part 4, item 1)
5. Work through Part 2's fake-data pages one at a time — I gave you a real page to copy the pattern from for each
6. Wire up the small dead buttons in Part 3
7. File uploads (Part 4, item 2) — biggest remaining job, save for last
