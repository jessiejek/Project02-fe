# E2E coverage summary

Generated Nov 20, 2026 (Asia/Manila) from `e2e/COVERAGE-PLAN.md` §3 + every `page.tsx` route on `main` (incl. the redirect routes), mapped to the specs in `e2e/journeys/`. COVERED = every flow in the plan has a passing (or BUG-linked `test.fail`) test; PARTLY = main flow tested, named gaps remain; NOT = no test.

## Totals

| | Items | COVERED | PARTLY | NOT |
|---|---|---|---|---|
| Routes (pages + redirects) | 58 | 48 | 9 | 1 |
| Forms | 67 | 50 | 9 | 8 |

**Pages: 48/58 fully covered, 57/58 at least partly. Forms: 50/67 fully covered, 59/67 at least partly.**

Also covered beyond the plan: §5 security (47 tests: role fences, logged-out, expired cookies, API wrong-role, patient A↔B, private templates), §6 screen sizes (28 tests, iPad portrait + phone), §4 journeys J1–J6, smoke (37 route-loads), 26 bug-hunt tests in s2 (B1–B7).

## Routes

| Role | Route | Status | Where / gaps |
|---|---|---|---|
| Public | `/` | COVERED | auth.spec, s5 (logged-out redirect to /login) |
| Public | `/login` | COVERED | s3-public (18 tests: errors, toggle, 4 roles, ?next=, open-redirect, double submit) |
| Public | `/register` | COVERED | s3-public (16 tests) |
| Public | `/forgot-password` | COVERED | s3-public (3 tests) |
| Patient | `/patient/dashboard` | COVERED | s3-patient-b (4), s4 J1 |
| Patient | `/patient/privacy-consent` | COVERED | s3-patient-a, s4 J4 (re-consent after version bump) |
| Patient | `/patient/profile` | COVERED | s3-patient-a (10 incl. password change) |
| Patient | `/patient/doctors` | COVERED | s3-patient-a |
| Patient | `/patient/doctors/[id]` | COVERED | s3-patient-a (+ unknown id); Specialty filter / Sort by dropdowns not exercised → see forms |
| Patient | `/patient/bookings` | COVERED | s3-patient-a (7), s2 B6/B7 |
| Patient | `/patient/bookings/[id]` | COVERED | s3-patient-a (3) |
| Patient | `/patient/documents` | COVERED | s3-patient-b (12 upload + search) |
| Patient | `/patient/lab-results` | COVERED | s3-patient-b (11 upload) |
| Patient | `/patient/medical-records` | COVERED | s3-patient-b |
| Patient | `/patient/prescriptions` | COVERED | s3-patient-b (print sheet) |
| Patient | `/patient/vaccinations` | COVERED | s3-patient-b |
| Patient | `/patient/reviews/[bookingId]` | COVERED | s3-patient-a (5), s2 B4 |
| Staff | `/staff/dashboard` | COVERED | s3-staff-c (4) |
| Staff | `/staff/walk-in` | COVERED | s3-staff-a (≈17) |
| Staff | `/staff/queue` | PARTLY | s3-staff-a (7): hold/call/complete/no-show/cancel/check-in covered; 'cancel after paid blocked' NOT |
| Staff | `/staff/bookings (redirect)` | COVERED | s0 redirect → /staff/queue |
| Staff | `/staff/bookings/[id]` | PARTLY | s3-staff-b (≈20): pay, waive, check-in/undo, no-show, cancel, reschedule covered; staff 'Confirm' action and OR number/Notes fields not asserted |
| Staff | `/staff/payments` | COVERED | s3-staff-b (4), s2 B2/B3 |
| Staff | `/staff/doctor-status` | COVERED | s3-staff-c (3), s4 J6 |
| Staff | `/staff/patients` | PARTLY | s3-staff-c (search/paging/open); 'create account' modal NOT |
| Staff | `/staff/patients/[id]` | COVERED | s3-staff-c (2) |
| Staff | `/staff/announcements` | COVERED | s3-staff-c (2) |
| Staff | `/staff/profile` | COVERED | s3-staff-c (4) |
| Doctor | `/doctor/dashboard` | COVERED | s3-doctor-a (5), doctor-scope-pages, s4 J6; BUG-41 test.fail |
| Doctor | `/doctor/appointments` | COVERED | s3-doctor-a (4), doctor-scope-pages |
| Doctor | `/doctor/appointments/[id]` | COVERED | s3-doctor-a |
| Doctor | `/doctor/patients` | COVERED | s3-doctor-b |
| Doctor | `/doctor/patients/[id]` | PARTLY | s3-doctor-b (tabs, vitals toggle, empty states, not-found); Rx copy/print/delete from chart NOT |
| Doctor | `/doctor/patients/[id]/prescriptions/create` | COVERED | s3-doctor-b (5) |
| Doctor | `/doctor/patients/[id]/prescriptions/[prescriptionId]` | COVERED | s3-doctor-b (edit test) |
| Doctor | `/doctor/consultation2/[bookingId]` | PARTLY | s7 (13), consultation-minimal, regression-matrix, full-visit, product-decisions, batch; gaps listed under Forms |
| Doctor | `/doctor/consultation/[bookingId] (redirect)` | COVERED | s0 redirect keeps query string |
| Doctor | `/doctor/consultation/[bookingId]/vitals (legacy)` | NOT | no spec visits it |
| Doctor | `/doctor/performance` | COVERED | doctor-performance (10) |
| Doctor | `/doctor/schedule` | COVERED | s3-doctor-a (7); some are test.fail for known bugs |
| Doctor | `/doctor/profile` | COVERED | s3-doctor-a (4) |
| Doctor | `/doctor/settings (redirect)` | COVERED | s0 + s3-doctor-a |
| Doctor | `/doctor/templates` | PARTLY | templates-workspace (6), rx-templates (4); Favorites CRUD/reorder, Diagnoses+ICD, Certificates CRUD NOT |
| Admin | `/admin/dashboard` | COVERED | s3-admin-b (3) |
| Admin | `/admin/bookings` | COVERED | s3-admin-b (list, week view) |
| Admin | `/admin/bookings/[id]` | PARTLY | s3-admin-b (≈13): confirm/reject/complete/cancel/no-show/reschedule/waive/refund; 'reject proof' NOT |
| Admin | `/admin/calendar (redirect)` | COVERED | s0 + s3-admin-b |
| Admin | `/admin/walk-in` | COVERED | s3-staff-a (admin variant) |
| Admin | `/admin/doctors` | COVERED | s3-admin-a (8) |
| Admin | `/admin/doctors/new` | PARTLY | s3-admin-a: validation + cancel; successful create → doctor logs in via invite NOT |
| Admin | `/admin/doctors/[id]/edit` | COVERED | s3-admin-a |
| Admin | `/admin/staff` | COVERED | s3-admin-a (4) |
| Admin | `/admin/patients` | COVERED | s3-admin-a (3) |
| Admin | `/admin/patients/[id]` | COVERED | s3-admin-a (2) |
| Admin | `/admin/announcements` | COVERED | s3-admin-a (4) |
| Admin | `/admin/settings` | PARTLY | s3-admin-b (≈11): General/Hours/Fees/Payments/Privacy covered; Logo + Favicon upload NOT (Branding tab preview only) |
| Admin | `/admin/reports` | COVERED | s3-admin-b (4) incl. CSV |
| Admin | `/admin/audit-logs` | COVERED | s3-admin-b (2) |

## Forms

| Role | Form | Status | Where / gaps |
|---|---|---|---|
| Public | Login | COVERED | s3-public |
| Public | Register | COVERED | s3-public |
| Public | Forgot password | COVERED | s3-public |
| Patient | Privacy consent (checkbox + Agree) | COVERED | s3-patient-a |
| Patient | Profile (all fields) | COVERED | s3-patient-a |
| Patient | Change password | COVERED | s3-patient-a |
| Patient | Doctors browse filters (Specialty / Sort by) | NOT | list + detail covered, filters never driven |
| Patient | Book a visit (date) | COVERED | s3-patient-a, B6/B7 |
| Patient | Cancel booking modal | COVERED | s3-patient-a |
| Patient | Upload document | COVERED | s3-patient-b |
| Patient | Upload lab result | COVERED | s3-patient-b |
| Patient | Review (rating + comment) | COVERED | s3-patient-a |
| Staff | Walk-in step 1 (search/page/select) | COVERED | s3-staff-a |
| Staff | Walk-in quick register | COVERED | s3-staff-a |
| Staff | Walk-in step 2 (type/discount/med cert) | COVERED | s3-staff-a |
| Staff | Queue actions (hold/call/complete/no-show/cancel + reason) | COVERED | s3-staff-a |
| Staff | Record payment (booking detail) | COVERED | s3-staff-b |
| Staff | Record payment (/staff/payments) | COVERED | s3-staff-b |
| Staff | Waive professional fee | COVERED | s3-staff-b, s4 J5 |
| Staff | Reschedule | COVERED | s3-staff-b |
| Staff | No-show / Cancel booking (reason) | COVERED | s3-staff-b |
| Staff | Doctor status (per doctor + bulk) | PARTLY | per-doctor choices covered; the bulk buttons not separately asserted |
| Staff | Patient list: create account modal | NOT |  |
| Staff | Profile (name/contact) | COVERED | s3-staff-c |
| Staff | Change password | COVERED | s3-staff-c |
| Doctor | Dashboard: availability status | COVERED | s3-doctor-a |
| Doctor | Dashboard: analytics range (This month/year/Custom) | COVERED | s3-doctor-a |
| Doctor | Appointments search/filters/History | COVERED | s3-doctor-a |
| Doctor | Schedule: weekly hours + daily limit | COVERED | s3-doctor-a (some test.fail, BUG-linked) |
| Doctor | Schedule: block date + remove | COVERED | s3-doctor-a |
| Doctor | Profile (name/spec/license/PTR/S2/fee/bio) | COVERED | s3-doctor-a |
| Doctor | Change password | COVERED | s3-doctor-a |
| Doctor | Prescription form (create/edit, allergy block, dup item, template title) | COVERED | s3-doctor-b |
| Doctor | Consultation: Clinical notes (SOAP) + review/save | COVERED | s7, matrix, full-visit |
| Doctor | Consultation: Vital signs (BP/pulse etc.) + Save vital signs | COVERED | s7, full-visit |
| Doctor | Consultation: Vitals 'Add measurement' (fundal height, FHR) + out-of-range warning | NOT |  |
| Doctor | Consultation: Allergy banner (add / NKDA) | PARTLY | NKDA covered; allergy-blocks-drug covered on patient Rx page only |
| Doctor | Consultation: Diagnosis (free text, remove, saved diagnosis) | PARTLY | typed diagnosis + saved dx covered; ICD-10 search / 'make primary' not asserted |
| Doctor | Consultation: Prescription (typed item, no-meds, Sig) | PARTLY | covered; Favorites, Refill last visit, weight-based calculator NOT |
| Doctor | Consultation: Lab orders (grid + 'Add another test') | PARTLY | full-visit; ANC presets for pregnant patient NOT |
| Doctor | Consultation: Follow-up (date / PRN / none) | COVERED | full-visit, s7, helpers |
| Doctor | Consultation: Medical certificate | PARTLY | full-visit/matrix; templates + print confirm not fully driven |
| Doctor | Consultation: Vaccinations (More) | PARTLY | matrix/full-visit; NIP 'give today' NOT |
| Doctor | Consultation: Professional fee decision (More) | COVERED | product-decisions, s4 J5 |
| Doctor | Consultation: Complete (checklist → Confirm & Complete) | COVERED | s7, minimal, matrix |
| Doctor | Consultation: Amend / cancel amendment / history | PARTLY | matrix (amend, cancel); BUG-40 test.fail; 'history' view NOT |
| Doctor | Templates: phrases / SOAP / Rx sets | COVERED | templates-workspace, rx-templates |
| Doctor | Templates: Favorites | NOT |  |
| Doctor | Templates: Diagnoses (ICD-10) | NOT |  |
| Doctor | Templates: Certificates | NOT |  |
| Admin | Doctor form (edit all fields) | COVERED | s3-admin-a |
| Admin | Doctor form (new / invite) | PARTLY | validation + cancel; no successful create |
| Admin | Doctor deactivate / reactivate | COVERED | s3-admin-a |
| Admin | Staff invite / revoke / activate / deactivate | COVERED | s3-admin-a |
| Admin | Add patient | COVERED | s3-admin-a |
| Admin | Edit patient | COVERED | s3-admin-a |
| Admin | Announcement create/edit/hide/delete | COVERED | s3-admin-a |
| Admin | Booking actions (confirm/reject/complete/cancel/no-show/reschedule/waive/refund) | COVERED | s3-admin-b |
| Admin | Booking: reject payment proof | NOT |  |
| Admin | Settings: General | COVERED | s3-admin-b |
| Admin | Settings: Hours | COVERED | s3-admin-b |
| Admin | Settings: Fees | COVERED | s3-admin-b |
| Admin | Settings: Payments | COVERED | s3-admin-b |
| Admin | Settings: Privacy + consent bump | COVERED | s3-admin-b, s4 J4 |
| Admin | Settings: Branding (logo/favicon upload) | NOT | preview only |
| Admin | Reports (range pickers, CSV) | COVERED | s3-admin-b |
| Admin | Audit-log search/filter/paging | COVERED | s3-admin-b |

## NOT covered / PARTLY gaps (to do next)

- **PARTLY** — /staff/queue: s3-staff-a (7): hold/call/complete/no-show/cancel/check-in covered; 'cancel after paid blocked' NOT
- **PARTLY** — /staff/bookings/[id]: s3-staff-b (≈20): pay, waive, check-in/undo, no-show, cancel, reschedule covered; staff 'Confirm' action and OR number/Notes fields not asserted
- **PARTLY** — /staff/patients: s3-staff-c (search/paging/open); 'create account' modal NOT
- **PARTLY** — /doctor/patients/[id]: s3-doctor-b (tabs, vitals toggle, empty states, not-found); Rx copy/print/delete from chart NOT
- **PARTLY** — /doctor/consultation2/[bookingId]: s7 (13), consultation-minimal, regression-matrix, full-visit, product-decisions, batch; gaps listed under Forms
- **NOT** — /doctor/consultation/[bookingId]/vitals (legacy): no spec visits it
- **PARTLY** — /doctor/templates: templates-workspace (6), rx-templates (4); Favorites CRUD/reorder, Diagnoses+ICD, Certificates CRUD NOT
- **PARTLY** — /admin/bookings/[id]: s3-admin-b (≈13): confirm/reject/complete/cancel/no-show/reschedule/waive/refund; 'reject proof' NOT
- **PARTLY** — /admin/doctors/new: s3-admin-a: validation + cancel; successful create → doctor logs in via invite NOT
- **PARTLY** — /admin/settings: s3-admin-b (≈11): General/Hours/Fees/Payments/Privacy covered; Logo + Favicon upload NOT (Branding tab preview only)
- **NOT** — Doctors browse filters (Specialty / Sort by): list + detail covered, filters never driven
- **PARTLY** — Doctor status (per doctor + bulk): per-doctor choices covered; the bulk buttons not separately asserted
- **NOT** — Patient list: create account modal: no test
- **NOT** — Consultation: Vitals 'Add measurement' (fundal height, FHR) + out-of-range warning: no test
- **PARTLY** — Consultation: Allergy banner (add / NKDA): NKDA covered; allergy-blocks-drug covered on patient Rx page only
- **PARTLY** — Consultation: Diagnosis (free text, remove, saved diagnosis): typed diagnosis + saved dx covered; ICD-10 search / 'make primary' not asserted
- **PARTLY** — Consultation: Prescription (typed item, no-meds, Sig): covered; Favorites, Refill last visit, weight-based calculator NOT
- **PARTLY** — Consultation: Lab orders (grid + 'Add another test'): full-visit; ANC presets for pregnant patient NOT
- **PARTLY** — Consultation: Medical certificate: full-visit/matrix; templates + print confirm not fully driven
- **PARTLY** — Consultation: Vaccinations (More): matrix/full-visit; NIP 'give today' NOT
- **PARTLY** — Consultation: Amend / cancel amendment / history: matrix (amend, cancel); BUG-40 test.fail; 'history' view NOT
- **NOT** — Templates: Favorites: no test
- **NOT** — Templates: Diagnoses (ICD-10): no test
- **NOT** — Templates: Certificates: no test
- **PARTLY** — Doctor form (new / invite): validation + cancel; no successful create
- **NOT** — Booking: reject payment proof: no test
- **NOT** — Settings: Branding (logo/favicon upload): preview only
