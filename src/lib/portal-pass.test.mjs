import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('design system defines the body-sm type role that pages already use', () => {
  assert.match(read('app/globals.css'), /--text-body-sm: 13px;/);
  assert.match(read('app/globals.css'), /--container-page-heading:/);
});

test('sign-in pages share one auth frame, persistent labels and semantic alerts', () => {
  for (const p of ['app/login/page.tsx', 'app/register/page.tsx', 'app/forgot-password/page.tsx']) {
    const src = read(p);
    assert.match(src, /<AuthShell/, p);
    assert.match(src, /labelStyles/, p);
    assert.doesNotMatch(src, /bg-green-50|text-green-800/, p);
  }
  assert.match(read('app/login/page.tsx'), /"Log in"/);
  assert.match(read('app/login/page.tsx'), /autoComplete="current-password"/);
});

test('password reset never reveals whether an account exists', () => {
  const src = read('app/forgot-password/page.tsx');
  assert.match(src, /If an account exists for/);
  assert.match(src, /loading={submitting}/);
});

test('public home highlights today from the clinic timezone, not the viewer', () => {
  const src = read('app/page.tsx');
  assert.match(src, /getUTCDay/);
  assert.match(src, /aria-current={isToday \? "date"/);
});

const ADMIN_PAGES = ['dashboard', 'bookings', 'bookings/[id]', 'patients', 'patients/[id]', 'doctors', 'staff', 'announcements', 'audit-logs', 'reports', 'settings']
  .map(p => `app/admin/${p}/page.tsx`);

test('admin pages use the shared header and never nest a button inside a link', () => {
  for (const p of ADMIN_PAGES) {
    const src = read(p);
    assert.doesNotMatch(src, /<Link[^>]*>\s*<Button/, p);
    assert.doesNotMatch(src, /<h2 className="text-headline-lg/, p);
  }
  for (const p of ADMIN_PAGES.filter(p => !p.includes('[id]'))) assert.match(read(p), /<PageHeader/, p);
  assert.match(read('components/admin/DoctorForm.tsx'), /<PageHeader/);
  assert.match(read('components/walkin/WalkInWizard.tsx'), /<PageHeader/);
});

test('admin data screens show a recoverable error instead of an endless spinner or fake zeros', () => {
  for (const p of ADMIN_PAGES) assert.match(read(p), /<ErrorState/, p);
  assert.match(read('components/walkin/WalkInWizard.tsx'), /<ErrorState/);
});

test('admin writes show pending state and keep input on failure', () => {
  assert.match(read('app/admin/bookings/[id]/page.tsx'), /async function submitModal/);
  assert.match(read('app/admin/patients/page.tsx'), /Keep the modal and the typed details open on failure/);
  assert.match(read('app/admin/settings/page.tsx'), /async function run\(/);
  assert.match(read('app/admin/announcements/page.tsx'), /role="switch"/);
});

test('admin keeps the consent re-trigger warning and branding preview caveat', () => {
  const src = read('app/admin/settings/page.tsx');
  assert.match(src, /This will re-trigger the consent banner for every patient\./);
  assert.match(src, /preview-only for now/);
});

test('display tokens and helpers back the shared UI', () => {
  assert.match(read('app/globals.css'), /--text-display-sm: 48px;/);
  const fmt = read('lib/format.ts');
  assert.match(fmt, /timeZone: "UTC"/);
  assert.doesNotMatch(fmt, /toISOString/);
  assert.match(read('components/ui/BookingTimeline.tsx'), /statusLabel\(step\)/);
});

const STAFF_PAGES = ['dashboard', 'queue', 'bookings/[id]', 'patients', 'patients/[id]', 'payments', 'doctor-status', 'announcements', 'profile']
  .map(p => `app/staff/${p}/page.tsx`);

test('staff pages share the header, error and loading patterns', () => {
  for (const p of STAFF_PAGES) {
    const src = read(p);
    assert.match(src, /<ErrorState/, p);
    assert.doesNotMatch(src, /<Link[^>]*>\s*<Button/, p);
    assert.doesNotMatch(src, /<h2 className="text-headline-lg/, p);
  }
  for (const p of STAFF_PAGES.filter(p => !p.includes('[id]'))) assert.match(read(p), /<PageHeader/, p);
});

test('staff money writes keep the modal open and show the failure', () => {
  assert.match(read('app/staff/payments/page.tsx'), /Keep the modal and the typed details so the desk can retry/);
  assert.match(read('app/staff/bookings/[id]/page.tsx'), /setPayError\(/);
  assert.match(read('app/staff/bookings/[id]/page.tsx'), /Only record a waiver the doctor has already approved/);
});

test('every icon name used by the nav exists in the icon map', () => {
  const map = read('components/ui/Icon.tsx');
  for (const [, name] of read('lib/nav-config.ts').matchAll(/icon: "([a-z_]+)"/g)) assert.match(map, new RegExp(`\\b${name}: fa`), name);
  assert.match(map, /\badd: faPlus/);
  assert.match(map, /\barrow_forward: faArrowRight/);
});

const PATIENT_PAGES = ['dashboard', 'bookings', 'bookings/[id]', 'medical-records', 'prescriptions', 'lab-results', 'vaccinations', 'documents', 'profile', 'reviews/[bookingId]']
  .map(p => `app/patient/${p}/page.tsx`);

test('patient data pages show a retryable error instead of a blank or endless loading state', () => {
  for (const p of PATIENT_PAGES) {
    const src = read(p);
    assert.match(src, /<ErrorState/, p);
    assert.doesNotMatch(src, /<Link[^>]*>\s*<Button/, p);
    assert.doesNotMatch(src, /<h2 className="text-headline-lg/, p);
  }
  assert.doesNotMatch(read('app/patient/doctors/DoctorsBrowseClient.tsx'), /<Link[^>]*>\s*<Button/);
});

test('documents and lab results share one upload form', () => {
  for (const p of ['app/patient/documents/page.tsx', 'app/patient/lab-results/page.tsx']) assert.match(read(p), /<PatientFileUpload/, p);
  assert.doesNotMatch(read('components/patient/PatientFileUpload.tsx'), /bg-green-50/);
});

test('privacy consent save never hangs on a failed settings read', () => {
  const src = read('app/patient/privacy-consent/page.tsx');
  assert.ok(src.indexOf('try {') < src.indexOf('queryClinicSettings(supabase)'));
});
