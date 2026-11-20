# E2E coverage plan (built from the actual code — re-checked Nov 19 2026, 22:10, on `main` @ 1233a0b FE / f1d62d8 BE)

Source: every `src/app/**/page.tsx`, every form component in `src/components/**`,
`src/lib/data/*.ts` (all API calls), and the .NET controllers in Project02-be.
Legend: [have] = an existing spec already covers it. Everything else is NEW.

## 0. Setup problems found (fix first)

1. **Wrong API port.** `e2e/playwright.config.ts` defaults `BE_URL` to `http://localhost:5000`;
   `.env.local` runs the API on `http://127.0.0.1:5055`. Unless `E2E_BE_URL` is set, `api(role)`
   seeding/cleanup talks to the wrong port. Default to the same value as `NEXT_PUBLIC_API_URL`.
2. **No console/network guard.** Add a fixture that fails a test on any uncaught page error or
   any unexpected 4xx/5xx from the API (allow-list expected ones per test).
3. **Leftover data.** e2e runs add patients/bookings to the dev DB. Every test must tag its data
   (`E2E-<runId>`) and delete it in `afterEach` via the API (`deletePatient` exists in support/api.ts).
4. **Redirect routes** (test only that they redirect): `/staff/bookings`→`/staff/queue`,
   `/admin/calendar`→`/admin/bookings`, `/doctor/settings`→`/doctor/profile`,
   `/doctor/consultation/[id]`→`/doctor/consultation2/[id]` (query string kept).

## 1. Business rules the tests must respect (from the code)

- Booking is a **first-come-first-served queue**, NOT time slots. `POST /api/bookings/book`
  takes `{ appointmentDate?, visitType?, notes? }`. Server rejects past dates ("Cannot book a past date.").
  There is no capacity cap. Don't write slot/full-slot tests.
- Patient cancel: only before check-in ("Only a booking that hasn't been checked in yet can be cancelled.").
- Queue cancel: reason required; not after seen; not after paid ("Refund it before cancelling.").
- Reschedule: not to a past date.
- Waive fee: Staff may only waive if the doctor set `pf_decision = 'Waive'`; Doctor/Admin can waive.
- Completed consultation: clinical changes only through **amend** (409 otherwise).
- Consult **Complete** needs: chief complaint, BP + pulse, ≥1 diagnosis, medicines OR "No medicines",
  and a follow-up choice (date / PRN / no follow-up).
- Vitals "out of range" (adult defaults, VitalsEditor.tsx): pulse 60–100, temp 36.1–37.2,
  RR 12–20, SpO2 95–100, weight 35–200, BP 90–140 / 60–90.
- Files: max 10 MB, allowed content types only (LocalFileStorageService.cs); must belong to the patient's booking.
- Review: rating 1–5, one review per booking.
- Register: password min 6, passwords must match, DOB max today, duplicate email → 409.

## 2. Suspected bugs to PROVE or DISPROVE (write a test for each, report result)

| # | Where | Suspicion | Test |
|---|---|---|---|
| B1 | Backend generally | **No server-side validation** on Patients, Announcements, Settings, StaffAccounts, Vitals, Vaccinations, LabOrders controllers (0 BadRequest). | Call each PUT/POST via `api(role)` with empty required fields, 5,000-char strings, wrong types. Expect 400. |
| B2 | `POST /api/payments/{id}/confirm` | **Still true in code:** `AmountReceived` not validated: negative / zero / huge accepted. | API: confirm with -50, 0, 99999999. Expect 400. |
| B3 | `/staff/payments` UI | Amount field: `Number("abc")` → NaN → silently records the full amount due; `0` also falls back to full amount; `-50` is sent as -50. | UI: type `abc`, `0`, `-50`. Expect a validation error, not a recorded payment. |
| B4 | `POST /api/reviews` | **Still true in code:** doesn't check the booking is **Completed**. Patient may review a pending/cancelled visit. | API as patient: review own pending booking. Expect 400/403. Also UI `/patient/reviews/[bookingId]` for a non-completed booking. |
| B5 | Double submit | Lower risk: `Button` disables itself while `loading`. Still verify payments, walk-in check-in, booking, review, announcements (Enter key can bypass a disabled button). | Double-click / press Enter twice. Expect exactly one record. |
| B6 | `POST /api/bookings/book` | **Confirmed in code:** no check for an existing booking — the same patient can book the same date twice and get two queue numbers. | Book today twice (UI and API). Expect the second to be refused. |
| B7 | `POST /api/bookings/book` + `/patient/bookings` | **Confirmed in code:** online booking ignores the doctor's **blocked dates** and the clinic's **closed days** (no check in BookingsController.BookOnline, no check in the page). | Doctor blocks tomorrow / admin marks a day Closed → patient books that day. Expect refusal. |

## 3. Tests per page (fields are the real ones from the code)

### Public
- `/login` [have: role landing]: wrong password, unknown email, empty fields, show/hide password, each role lands on its dashboard, `?next=` deep link after login.
- `/register`: First/Middle/Last name, Email, Contact number, Sex, Date of birth (max today), Password (min 6), Confirm password. Tests: happy path → can log in; mismatch → "Passwords do not match."; DOB in future blocked; duplicate email → message; password 5 chars blocked.
- `/forgot-password`: Email required; valid email shows the same neutral message for known/unknown email.

### Patient
- `/patient/privacy-consent`: checkbox required; without consent patient pages redirect here; after admin "bump consent version" (settings) patient sees it again.
- `/patient/profile`: First name*, Middle, Last name*, Sex, Date of birth, Contact (≥10 digits), Address, City, ZIP, Civil status, Blood type, PhilHealth #, HMO provider, HMO card #, emergency contact (Name, Relationship, Phone); password change (Current, New, Confirm). Tests: save + reload persists every field; "First name is required."; "Last name is required."; bad phone message; wrong current password; new≠confirm.
- `/patient/doctors` (DoctorsBrowseClient: Specialty filter, Sort by) and `/patient/doctors/[id]`: list loads, filter/sort works, "Book a visit" goes to bookings.
- `/patient/bookings`: Visit date (min today) → "Join today's queue" / "Book this day"; queue number shown; past date rejected; cancel modal (Keep booking / confirm) only before check-in; B6.
- `/patient/bookings/[id]`: timeline, fee/payment info, receipt modal after paid, cancel.
- `/patient/documents`, `/patient/lab-results` (PatientFileUpload): "Visit it belongs to" required, file required ("Choose a file to upload."), accepted types (.pdf .jpg .png .webp .gif .doc .docx), >10 MB rejected, wrong type rejected, search box filters, uploaded file opens.
- `/patient/medical-records`, `/patient/prescriptions` (print), `/patient/vaccinations`, `/patient/dashboard`: data from a completed visit shows; search filters; empty states.
- `/patient/reviews/[bookingId]`: Rating 1–5 required, Comment; submit once; second review → "already been reviewed"; B4.

### Staff
- `/staff/walk-in` (WalkInWizard, also `/admin/walk-in`): step 1 search patient (Name, code, phone, email) + paging, quick-register (Sex, Date of birth max today, Contact, Address); step 2 visit type, Discount checkbox; check-in → ticket + queue number; "Next walk-in" resets; print ticket; B5.
- `/staff/queue`: actions call / check-in / hold / no-show / complete / cancel (Reason required); queue numbers unique when two staff check in at once; cancel after paid blocked.
- `/staff/bookings/[id]`: Check in, Confirm, Reschedule (New appointment date, Reason optional, past date blocked), Mark no-show, Waive professional fee (only if doctor chose Waive), record payment (Amount received, Method, Reference number, OR number, Notes), receipt modal.
- `/staff/payments`: Record payment (Amount received, Method, Reference number optional, Notes); paid row disappears; B2, B3, B5.
- `/staff/doctor-status`: per-doctor status + bulk Available / Running late / Unavailable today; doctor dashboard reflects it.
- `/staff/patients`, `/staff/patients/[id]`: search + paging; create account modal.
- `/staff/announcements` shows active ones only; `/staff/profile`: Full name required ("Enter your full name."), Contact, password change.
- `/staff/dashboard`: counts match API; check-in toggle.

### Doctor
- `/doctor/performance` [have: doctor-performance.spec + doctor-scope-pages.spec] — only add: period toggle values persist in URL on reload.
- `/doctor/dashboard` [have: partly, doctor-scope-pages.spec]: counts match API; Available / Running late / Unavailable today; analytics range This month / This year / Custom (From, To; From > To?).
- `/doctor/appointments` (+ `[id]`): scope tabs, status filter, date range, search patient/queue #, paging.
- `/doctor/patients` (+ `[id]`): search; chart shows consultations, vitals list/table toggle, prescriptions copy / edit / print / delete (confirm).
- `/doctor/patients/[id]/prescriptions/create` and `/[prescriptionId]`: PrescriptionForm (below).
- `/doctor/consultation2/[bookingId]` [have: most flows] — ADD what's missing:
  - Allergy banner: add allergy, NKDA, allergy blocks a matching drug in Rx ("allergyBlockReason").
  - Vitals: every field + "Add measurement" (fundal height, FHR); out-of-range warning per §1; Save vital signs.
  - Diagnosis: ICD-10 search, free text, make primary, remove, insert saved diagnosis (with ICD code).
  - Prescription (PrescriptionForm): medication search/typed, Dosage, Quantity, Route, Indication, meal relation, timing slots, duration, Sig; weight-based calc (Weight kg, mg/kg, mg/mL, Max mg); duplicate item → "Item already exist."; save-as-template needs title ("Template title required!"); Favorites, Templates, Refill last visit Rx; print needs full sig.
  - Lab orders: checkbox grid, "Add another test", ANC presets for pregnant patient.
  - Follow-up: date / PRN / no follow-up.
  - Med cert: address, exam from/until, diagnosis, recommendations, except ___, come back on; templates; print confirm.
  - Vaccinations (under More): Vaccine name, Dose #, Lot #, Manufacturer, Expiry, Site, Route, Notes; NIP "give today".
  - Professional fee (under More): decision + Amount + "Reason (minimum 5 characters)".
  - Amend a completed consult; cancel amendment; history.
- `/doctor/schedule`: per-day start/end time (end must be after start), closed days, Daily patient limit (non-negative whole number or blank), Block this date (Reason) / remove; patient cannot book a blocked date.
- `/doctor/profile`: Full name, Specialization, License #, PTR #, S2 #, Consultation fee, Bio, password change.
- `/doctor/templates` [have: templates-workspace.spec, rx-templates.spec incl. 'Edit on every row / System edit becomes your copy']: ADD Rx set CRUD incl. route/meals/timing/duration/indication persist; Favorites add/edit/reorder/delete; Diagnoses with ICD-10; Certificates CRUD + preview; Duplicate to mine for each tab.

### Admin
- `/admin/doctors`, `/admin/doctors/new`, `/admin/doctors/[id]/edit` (DoctorForm): Full name, Email, Specialty, PRC license, PTR, S2, Consultation fee (₱), Slot duration, Status, Bio, weekly hours; create → doctor can log in (invite); deactivate (confirm / Keep active).
- `/admin/staff`: invite (Full name, Email), revoke invite, activate/deactivate.
- `/admin/patients` (+ `[id]`): search + paging; Add patient (DOB max today, required fields); edit ("First name, last name, and date of birth are required.").
- `/admin/bookings` (List/Week, search, any date, week nav) and `/admin/bookings/[id]`: confirm, complete, pay, cancel / reject (Reason), reject proof, no-show, reschedule, waive, refund (Amount ₱ + Reason; refund > amount paid?), OR number.
- `/admin/announcements`: Title, Message, Active toggle; create / edit / delete (Keep it); staff + patients see active ones.
- `/admin/settings`: Clinic name*, Address*, Contact, Email, Description, Website URL; opening hours per day (time, Closed); fees (Standard consultation, Follow-up, Medical certificate add-on, Senior/PWD discount 0–100); payment methods (Pay at clinic, Online, Bank transfer, accepted at front desk); Default payment mode; Refund policy; Privacy policy; Consent version bump (confirm → patients re-consent); Logo + Favicon upload (image/*). Each section's Save persists after reload; changed fee shows on new bookings.
- `/admin/reports`: each view loads, totals match API, CSV download works.
- `/admin/audit-logs`: an action done earlier in the run appears with the right user; search + paging.
- `/admin/dashboard`: counts match API.

## 4. Cross-role journeys (use `as(role)` with several browsers)
1. Patient books today → staff checks in → doctor consults & completes (all sections) → staff records payment → patient sees record, Rx, vaccination, can review; admin audit log shows each step.
2. Doctor blocks tomorrow → patient can't book tomorrow (expected to FAIL today — see B7).
3. Admin changes standard fee → next booking's amount due uses it.
4. Admin bumps consent version → patient forced to re-consent.
5. Doctor sets PF decision "Waive" → staff can waive; without it staff gets "Only the doctor can waive…".
6. Staff sets doctor "Unavailable today" → doctor dashboard + patient doctor page reflect it.

## 5. Security (UI and API)
- Each role typing another portal's URL → redirected/blocked [have: partly].
- Patient A cannot GET/PUT patient B's profile, bookings, files, reviews (swap IDs).
- Doctor cannot read another doctor's private templates; Staff only sees system Rx sets.
- Logged out → /login; expired cookie → clean re-login, no data loss message.

## 6. Screen sizes
Run journeys 1, the consultation, and the patient portal also at iPad portrait (768×1024)
and phone (375×812, patient portal only).
