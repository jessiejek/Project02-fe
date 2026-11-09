# Design deep-pass checklist

All application page routes, grouped by portal. API handlers and framework-generated error routes are not page routes.

Status: doctor portal complete. Public and auth pass complete (shared `AuthShell`, `FormAlert`, `fieldStyles`, `PageHeader`; `--text-body-sm` token). Admin pass complete (`InfoField`, `lib/format.ts`, shared `WalkInWizard` and `DoctorForm`; `--text-display-sm` token). Staff pass complete (queue mobile cards, payment and booking-detail error handling; missing `view_list`, `add` and `arrow_forward` icons mapped). Remaining portal: patient.

## Doctor (14)

- [x] `/doctor/appointments` — `src/app/doctor/appointments/page.tsx`
- [x] `/doctor/appointments/[id]` — `src/app/doctor/appointments/[id]/page.tsx`
- [x] `/doctor/consultation/[bookingId]` — `src/app/doctor/consultation/[bookingId]/page.tsx`
- [x] `/doctor/consultation/[bookingId]/vitals` — `src/app/doctor/consultation/[bookingId]/vitals/page.tsx`
- [x] `/doctor/consultation2/[bookingId]` — `src/app/doctor/consultation2/[bookingId]/page.tsx`
- [x] `/doctor/dashboard` — `src/app/doctor/dashboard/page.tsx`
- [x] `/doctor/patients` — `src/app/doctor/patients/page.tsx`
- [x] `/doctor/patients/[id]` — `src/app/doctor/patients/[id]/page.tsx`
- [x] `/doctor/patients/[id]/prescriptions/[prescriptionId]` — `src/app/doctor/patients/[id]/prescriptions/[prescriptionId]/page.tsx`
- [x] `/doctor/patients/[id]/prescriptions/create` — `src/app/doctor/patients/[id]/prescriptions/create/page.tsx`
- [x] `/doctor/profile` — `src/app/doctor/profile/page.tsx`
- [x] `/doctor/schedule` — `src/app/doctor/schedule/page.tsx`
- [x] `/doctor/settings` — `src/app/doctor/settings/page.tsx`
- [x] `/doctor/templates` — `src/app/doctor/templates/page.tsx`

## Public (1)

- [x] `/` — `src/app/page.tsx`

## Auth (3)

- [x] `/forgot-password` — `src/app/forgot-password/page.tsx`
- [x] `/login` — `src/app/login/page.tsx`
- [x] `/register` — `src/app/register/page.tsx`

## Admin (15)

- [x] `/admin/announcements` — `src/app/admin/announcements/page.tsx`
- [x] `/admin/audit-logs` — `src/app/admin/audit-logs/page.tsx`
- [x] `/admin/bookings` — `src/app/admin/bookings/page.tsx`
- [x] `/admin/bookings/[id]` — `src/app/admin/bookings/[id]/page.tsx`
- [x] `/admin/calendar` — `src/app/admin/calendar/page.tsx`
- [x] `/admin/dashboard` — `src/app/admin/dashboard/page.tsx`
- [x] `/admin/doctors` — `src/app/admin/doctors/page.tsx`
- [x] `/admin/doctors/[id]/edit` — `src/app/admin/doctors/[id]/edit/page.tsx`
- [x] `/admin/doctors/new` — `src/app/admin/doctors/new/page.tsx`
- [x] `/admin/patients` — `src/app/admin/patients/page.tsx`
- [x] `/admin/patients/[id]` — `src/app/admin/patients/[id]/page.tsx`
- [x] `/admin/reports` — `src/app/admin/reports/page.tsx`
- [x] `/admin/settings` — `src/app/admin/settings/page.tsx`
- [x] `/admin/staff` — `src/app/admin/staff/page.tsx`
- [x] `/admin/walk-in` — `src/app/admin/walk-in/page.tsx`

## Staff (11)

- [x] `/staff/announcements` — `src/app/staff/announcements/page.tsx`
- [x] `/staff/bookings` — `src/app/staff/bookings/page.tsx`
- [x] `/staff/bookings/[id]` — `src/app/staff/bookings/[id]/page.tsx`
- [x] `/staff/dashboard` — `src/app/staff/dashboard/page.tsx`
- [x] `/staff/doctor-status` — `src/app/staff/doctor-status/page.tsx`
- [x] `/staff/patients` — `src/app/staff/patients/page.tsx`
- [x] `/staff/patients/[id]` — `src/app/staff/patients/[id]/page.tsx`
- [x] `/staff/payments` — `src/app/staff/payments/page.tsx`
- [x] `/staff/profile` — `src/app/staff/profile/page.tsx`
- [x] `/staff/queue` — `src/app/staff/queue/page.tsx`
- [x] `/staff/walk-in` — `src/app/staff/walk-in/page.tsx`

## Patient (13)

- [ ] `/patient/bookings` — `src/app/patient/bookings/page.tsx`
- [ ] `/patient/bookings/[id]` — `src/app/patient/bookings/[id]/page.tsx`
- [ ] `/patient/dashboard` — `src/app/patient/dashboard/page.tsx`
- [ ] `/patient/doctors` — `src/app/patient/doctors/page.tsx`
- [ ] `/patient/doctors/[id]` — `src/app/patient/doctors/[id]/page.tsx`
- [ ] `/patient/documents` — `src/app/patient/documents/page.tsx`
- [ ] `/patient/lab-results` — `src/app/patient/lab-results/page.tsx`
- [ ] `/patient/medical-records` — `src/app/patient/medical-records/page.tsx`
- [ ] `/patient/prescriptions` — `src/app/patient/prescriptions/page.tsx`
- [ ] `/patient/privacy-consent` — `src/app/patient/privacy-consent/page.tsx`
- [ ] `/patient/profile` — `src/app/patient/profile/page.tsx`
- [ ] `/patient/reviews/[bookingId]` — `src/app/patient/reviews/[bookingId]/page.tsx`
- [ ] `/patient/vaccinations` — `src/app/patient/vaccinations/page.tsx`

Total: 57 application page routes.

Consultation verification: production build passed; 64/64 unit tests passed; lint passed with 0 errors (34 existing warnings); guarded 1440px/390px browser checks passed.
