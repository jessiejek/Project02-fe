# AI-HANDOFF — Project02-fe (Next.js 16 frontend)

> **Who this is for:** an AI agent (or developer) picking up this repo cold.
> **Companion file:** `../Project02-be/AI-HANDOFF.md` (.NET API, DB, migrations, endpoint list, state machines). Read both. The FE↔BE contract is in §13 here and mirrored there.
> **Written:** Nov 20, 2026 (Asia/Manila), from reading the actual code at `main @ 8a9f4d1` (`github.com/jessiejek/Project02-fe`).
> Anything not verified is marked **(unverified)** with what was checked.

---

## 0. TL;DR

- **Product:** "Dr. Grace Gavino Medical Clinic" (`layout.tsx` metadata, PWA `short_name: "Gavino Clinic"`). Printed letterhead: **ALLYN GRACE T. ESPAÑA-GAVINO, MD, Family and Community Medicine, Adult and Pedia, GRACE MEDICAL CLINIC, 3ML Quezon National Highway, Buaya, Lapu Lapu City**. Sold to a **non-technical Family Medicine doctor in the Philippines**. Jessie calls it "Project02" / the Gavino Clinic app.
- **This repo:** Next.js 16.2.10 App Router + React 19.2.4 + Tailwind 4, four role portals (patient / staff / doctor / admin). **Talks only to the .NET API** (Project02-be). Supabase is gone from the app bundle (only legacy scripts under `scripts/parity`, `scripts/dev` and `supabase/*.sql` remain).
- **Run:** `nvm use 22` (default v22.23.4) → `npx next dev --webpack` on **:3000**. API must be on **:5055**.
- **Tests:** `npm run test:unit` (Node built-in test runner over `src/**/*.test.mjs`) — last known **235/237** (2 pre-existing failures). E2E Playwright in `e2e/`.
- **AGENTS.md warning (keep heeding it):** *"This is NOT the Next.js you know… Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."* Example: middleware is **`src/proxy.ts`** (Next 16 "proxy"), not `middleware.ts`.

---

## 1. Purpose, users, roles

| Role (JWT `role`) | URL segment | Sidebar subtitle | What they do |
|---|---|---|---|
| Patient | `/patient/*` | Patient Portal | Book with "Your Doctor", see bookings, medical records, prescriptions, vaccinations, documents/lab results, privacy consent, profile, reviews |
| Staff | `/staff/*` | Staff Terminal | Front desk: today's queue, walk-ins, payments, patients, doctor status, announcements |
| Doctor | `/doctor/*` | Doctor workspace | Today, appointments, patient charts, **consultation** (main screen), performance, availability, templates, profile |
| Admin | `/admin/*` | Clinic Administration | Dashboard, bookings, walk-in, doctors, patients, staff, announcements, settings, audit logs, reports |

Nav is defined in `src/lib/nav-config.ts` (`ROLE_CONFIG`). The doctor is the key user: **never make her type what the app already knows.**

---

## 2. Tech stack & versions (package.json)

| Thing | Version |
|---|---|
| Node | via **nvm**; default **v22.23.4** (v22.12.0, v20, v16 also installed). No `.nvmrc`. |
| next | **16.2.10** (`dev` script = `next dev --webpack`; `dev:turbo` = turbopack) |
| react / react-dom | 19.2.4 |
| TypeScript | ^5, strict, `@/*` → `src/*`, `allowImportingTsExtensions` |
| Tailwind | ^4 via `@tailwindcss/postcss` |
| jose | ^5.10 (JWT verify, HS256) |
| @microsoft/signalr | ^10.0.11 (realtime hub) |
| serwist / @serwist/turbopack | ^9.5.13 (PWA service worker) |
| Font Awesome | svg-core 7, free solid/regular, react-fontawesome 3 (plus Material Symbols ligatures in nav) |
| Playwright | ^1.63 (e2e) |
| esbuild | ^0.28 (dev dep, used by unit tests to load TS) |
| eslint | ^9 + eslint-config-next 16.2.10 |

---

## 3. Repo layout

```
Project02-fe/
├── AI-HANDOFF.md            ← this file
├── AGENTS.md / CLAUDE.md    Next-16 warning (CLAUDE.md just includes AGENTS.md)
├── README.md                create-next-app boilerplate + secrets note
├── DOTNET_FRONTEND_CONTRACT.md   ★ wire contract with the API (JSON keys, enum strings, embeds; §16 amendments, §17 risks, §18 checklist)
├── DOTNET_BACKEND_PLAN.md   original BE build plan
├── remaining.md             SUPERSEDED (pre-.NET migration)
├── truth*.md, truthDare.md  unrelated notes (not part of the app — unverified purpose; not read in depth)
├── account-list.txt, run-accounts.cmd   dev login list (contains dev creds — don't print)
├── docker-compose.yml, .env.example     same SQL Server compose as BE (SQL_SA_PASSWORD)
├── env.example              → copy to .env.local (app env vars)
├── next.config.ts           version env (commit count/time), security headers (prod), serwist rewrites, turbopack root
├── docs/                    audits/checklists (consultation-design-audit, ux-ui-audit, FINISH-*), docs/privacy/{AUDIT,HOW-DATA-IS-HANDLED,PRIVACY-NOTICE}.md
├── e2e/                     Playwright: playwright.config.ts, journeys/*.spec.ts, support/*, README, COVERAGE-*
├── public/forms/            logo.png, rx.png, seal.png, cartoon.png (print forms) · public/icons/ (PWA icons — PLACEHOLDERS)
├── scripts/                 verify-*/capture-* design/portal checkers, list-accounts.mjs, parity/ (Supabase vs .NET parity harness), dev/import-from-supabase.mjs
├── supabase/                legacy schema.sql, rls.sql, storage.sql, seed-*.sql (reference only)
├── .tmp-screens/            test screenshots — NEVER commit (archived copies live in ~/Documents/Allyn/tmp-screens-archive/)
└── src/
    ├── proxy.ts             ★ auth gate + silent token refresh (Next 16 proxy)
    ├── app/                 routes (see §6)
    ├── components/
    │   ├── shell/           AppShell, Sidebar (logout), Topbar, VersionFooter, mobile nav context
    │   ├── ui/              Button, Modal, Drawer, SidePanel, Toast + ToastHost, DataTable, DatePicker, Tabs, StepIndicator, StatusPill, Skeleton, …
    │   ├── doctor/          PrescriptionForm, RxTimingFields, Icd10DiagnosisField, DiagnosisCombobox, VitalsEditor, ClinicalNoteField, SoapFieldToolbar,
    │   │                    ConsultPatientBanner, ConsultMobileSectionStepper, PatientHistoryModal, GrowthChart, AppointmentPrintActions,
    │   │                    appointments/*, performance/*, templates/* (TemplatesWorkspace, SoapTab, PhrasesTab, RxTab, FavoritesTab, DiagnosesTab, CertsTab, useUndoableDelete, useTemplatesData)
    │   ├── admin/ (DoctorForm, DataRequestsPanel) · patient/ (PatientFileUpload, PrivacyTab) · walkin/WalkInWizard · bookings/RescheduleBookingModal
    │   ├── providers/SessionProvider.tsx · pwa/NetworkStatusBanner.tsx · auth/AuthShell.tsx
    ├── lib/
    │   ├── api/client.ts    ★ typed fetch client (API_BASE_URL, Bearer token, 401 retry) · friendly-error.ts
    │   ├── auth/            jwt.ts (verifyJwt), cookies.ts, session.ts (getServerSession), dotnet.ts (auth calls), logout-intent.ts, mode.ts, next.ts (safeNext), account.ts
    │   ├── data/*.ts        one module per resource — ALL API calls go through here (admin, bookings, clinical, doctors, labs, lookups, patientFiles, patients, payments, privacy, queue, scheduling, search, staff, doctor-performance, paging)
    │   ├── clinical/        consult-steps (step indicators, Prev/Next), preview-fee (PF helpers), drug-safety, peds-dosing, growth, ob, anc-labs, nip-schedule, soap-merge, rx-template-apply, med-cert-fields, template-* helpers
    │   ├── templates/       urlState (tabs, SHOW_DIAGNOSES_TAB), search, reorder, validation, historyGuard, format
    │   ├── rx-sig-parse.ts, rx-structured.ts   Rx sig parsing + structured Before/After & slot fields
    │   ├── pf-default.ts    PF default Charge + follow-up gate
    │   ├── mc-defaults.ts   med cert "examined at" default from letterhead
    │   ├── print.ts, print-forms.ts, print-forms-html.ts, consult-print.ts   printing
    │   ├── realtime/clinicHub.ts   SignalR client
    │   ├── clock.ts, bookingTime.ts, days.ts, format.ts   Manila-time helpers (never derive dates from UTC)
    │   └── *.test.mjs       unit tests (≈60 files)
    └── data/                types.ts, supabase-types.ts (legacy type shapes still used), mock.ts
```

Note: many `src/lib/data/*` functions still take a parameter named `supabase` for historical reasons — it is not Supabase anymore; calls go to the .NET API via `lib/api/client.ts`.

---

## 4. How to run locally (Jessie's MacBoy)

```bash
# prerequisites: DB container + API on :5055 (see ../Project02-be/AI-HANDOFF.md §4)
cd ~/Documents/Allyn/Project02-fe
nvm use 22            # default v22.23.4
npx next dev --webpack                     # http://localhost:3000  (same as `npm run dev`)
# background variant used by agents:
nohup npx next dev --webpack > /tmp/project02-fe-dev.log 2>&1 &
```
- FE changes hot-reload into the running :3000 (no restart needed).
- **Don't** run a second `next dev`/Playwright build against the same `.next` folder — two runs sharing `.next` corrupt it. Use a separate checkout/port for tests and only with Jessie's OK (no new worktrees per his rules).
- Other scripts: `npm run build`, `npm start`, `npm run lint`, `npx tsc --noEmit` (type check).

---

## 5. Environment variables (NAMES only — never print values)

`.env.local` (gitignored; template `env.example`):

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | .NET API base URL. Code default `http://localhost:5000`; Jessie's local value points at **:5055** |
| `DOTNET_API_URL` | present in .env.local (server-side API URL; usage unverified — grep found `NEXT_PUBLIC_API_URL` as the one `client.ts` reads) |
| `JWT_SECRET` (or `DOTNET_JWT_SECRET`) | server-only; **must equal BE `Jwt__Secret`** |
| `JWT_ISSUER`, `JWT_AUDIENCE` | default `ClinicApp` |
| `NEXT_PUBLIC_AUTH_MODE` | `dotnet` (default) or `supabase` (debug fallback only) |
| `NEXT_PUBLIC_API_MODE` | present in .env.local (legacy switch; unverified if still read) |
| `NEXT_PUBLIC_ENABLE_SW_DEV` | `1` to enable the service worker in dev |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | only for legacy `scripts/parity` and `scripts/dev` — app bundle doesn't use them |
| Build-time (set in next.config.ts) | `NEXT_PUBLIC_APP_VERSION` (git commit count), `NEXT_PUBLIC_BUILD_TIME` (commit time) → shown by `VersionFooter` |
| E2E | `E2E_FE_URL` (default :3000), `E2E_BE_URL` (default 127.0.0.1:5055), `E2E_SLOWMO`, `E2E_RUN_ID` |

`.env` (gitignored; template `.env.example`): `SQL_SA_PASSWORD` for docker compose.

---

## 6. Routes / pages (`src/app`)

Public (proxy lets these through): `/` (landing → redirects signed-in users to their dashboard), `/login`, `/register`, `/forgot-password`, `/privacy` (Privacy Notice page). Also `/logout` (route handler), `/manifest.webmanifest`, `/sw.js` (→ `/serwist/sw.js`), `/~offline`.

**Route handlers:** `POST /api/session/login`, `POST /api/session/register`, `GET /api/session/token`, `GET /api/public/privacy-notice` (`?lang=fil` for Filipino), `GET /logout`, `/serwist/[path]`, `/~offline`.
**Server actions:** `app/actions/createDoctor.ts`, `inviteStaffMember.ts`, `revokeStaffInvite.ts`.

| Patient | Purpose |
|---|---|
| /patient/dashboard | Home |
| /patient/doctors, /patient/doctors/[id] | "Your Doctor" — browse & book |
| /patient/bookings, /patient/bookings/[id] | My bookings (cancel while Pending) |
| /patient/medical-records | Consultations history |
| /patient/prescriptions | Rx history |
| /patient/vaccinations | Vaccination record |
| /patient/documents, /patient/lab-results | Uploaded files |
| /patient/privacy-consent | Consent decisions, data export, correction/deletion requests |
| /patient/profile | Profile, password |
| /patient/reviews/[bookingId] | Rate a completed visit |

| Staff | Purpose |
|---|---|
| /staff/dashboard | "Front desk today" |
| /staff/queue | "Today's queue" (check-in, call, hold, complete, no-show, cancel) |
| /staff/bookings → redirects to /staff/queue; /staff/bookings/[id] | Booking detail |
| /staff/walk-in | Walk-in wizard |
| /staff/payments | "Collect payments" (confirm, record waiver) |
| /staff/patients, /staff/patients/[id] | Patients |
| /staff/doctor-status | Doctor day status (Available / Running late / Unavailable) |
| /staff/announcements, /staff/profile | |

| Doctor | Purpose |
|---|---|
| /doctor/dashboard | "Your clinic today" |
| /doctor/appointments, /doctor/appointments/[id] | Appointment list / focus (print actions) |
| **/doctor/consultation2/[bookingId]** | ★ **The consultation screen** (~3,900 lines) — see §9 |
| /doctor/consultation/[bookingId] | Redirects to consultation2 (deep-link compat); `/vitals` sub-page |
| /doctor/patients, /doctor/patients/[id] | Patient charts; `/prescriptions/create`, `/prescriptions/[prescriptionId]` |
| /doctor/performance | Her own numbers (Collected/Billed, patients, trends) |
| /doctor/schedule | Availability (weekly schedule, blocked dates) |
| /doctor/templates | Templates workspace (`?tab=&field=&id=` deep links) |
| /doctor/profile | Profile |
| /doctor/settings | Redirects to /doctor/profile |

| Admin | Purpose |
|---|---|
| /admin/dashboard | Overview |
| /admin/bookings, /admin/bookings/[id] | All bookings (Mark Complete / No Show) ; /admin/calendar → redirects to bookings |
| /admin/walk-in | Walk-in |
| /admin/doctors, /new, /[id]/edit | Doctor management |
| /admin/patients, /[id] | Patients |
| /admin/staff | Front-desk staff (invite/revoke/deactivate) |
| /admin/announcements, /admin/settings (clinic settings, fees, hours, payment methods), /admin/audit-logs, /admin/reports | |

Most dynamic routes have a `loading.tsx` skeleton; `app/error.tsx` and `app/loading.tsx` are global.

---

## 7. Auth (how it actually works)

- **Mode:** `AUTH_MODE` = `dotnet` unless `NEXT_PUBLIC_AUTH_MODE=supabase` (`lib/auth/mode.ts`).
- **Login:** `/login` → `POST /api/session/login` → server calls BE `POST /api/auth/login` → sets httpOnly cookies **`clinic_at`** (access, 1 h) and **`clinic_rt`** (refresh, 7 d), `sameSite=lax`, `secure` in prod → returns `{ role }` → client routes to `/{role}/dashboard`. Register similarly (`/api/session/register`, password ≥ 12 chars, `acceptedPrivacyNotice`). `safeNext()` only honours same-site `/patient…` paths for `?next=`.
- **`src/proxy.ts`:** for every non-API, non-static path: verify `clinic_at` with `verifyJwt` (HMAC HS256 + issuer + audience, 30 s tolerance — never trusts a raw decode). If invalid/expired and `clinic_rt` exists → `dotnetAuth.refresh()` and set fresh cookies. Then **gate**: no role ⇒ only public paths, else redirect `/login`; a role visiting another role's segment ⇒ redirect to own `/{segment}/dashboard`; signed-in user on `/`, `/login`, `/register` ⇒ own dashboard. Role map: Patient→patient, Staff→staff, Doctor→doctor, Admin→admin. Matcher excludes `api`, `_next`, `logout`, `serwist`, `sw.js`, manifest, `~offline`, icons, images. `/logout` is explicitly skipped so a refresh can't re-issue cookies during logout.
- **Server components:** `getServerSession()` (`lib/auth/session.ts`) verifies the cookie and calls `/api/patients/me` or `/api/staff-accounts/me` → `SessionInfo { userId, role, displayName, avatarUrl, staffId (== doctorId for doctors), patientId }`.
- **Browser API calls:** `lib/api/client.ts` fetches the token from same-origin `GET /api/session/token` (cached 60 s; on 401 clears and retries once) and sends `Authorization: Bearer`.
- **Logout:** Sidebar → `GET /logout` → BE `/api/auth/logout` (revoke refresh), clear cookies, `Clear-Site-Data: "cache","storage"`, redirect `/login`. **`lib/auth/logout-intent.ts`** stores `clinic-logout-pending` (20 s) in storage so that if `next dev` Fast Refresh reloads the page and cancels the navigation (Safari), the app finishes the logout — "one-click logout". Not yet confirmed by Jessie in a browser.
- **Role-change lag:** role comes from the JWT; a demoted user keeps the old role until the access token is refreshed (≤ 1 h). Deactivation is enforced immediately by the BE.

---

## 8. Data access pattern

- All backend calls live in `src/lib/data/*.ts` → `api.get/post/put/delete` in `lib/api/client.ts`. **Do not call `fetch` to the API elsewhere.** Data resources are snake_case on the wire; auth is camelCase; no casing transform in the client.
- Realtime: `lib/realtime/clinicHub.ts` connects to `${API}/hubs/clinic` with the same token (staff queue/dashboard, doctor visits/dashboard, staff payments) — e.g. `PaymentUpdated`.
- Time: clinic is Asia/Manila; use `lib/clock.ts` helpers (e.g. `todayManila()`), never a UTC-derived date (there's a unit test "P0.4 no UTC-derived date").

---

## 9. The consultation screen (`src/app/doctor/consultation2/[bookingId]/page.tsx`)

**Sections** (`SECTIONS`, index → label): 0 Clinical notes · 1 Vital Signs · 2 Diagnosis · 3 Prescription · 4 Lab Orders · 5 Vaccinations · 6 Follow-up · 7 Medical Certificate · 8 Professional Fee Decision.
Display order `SECTION_ORDER = [0,1,2,3,4,6,7,5,8]` (Vaccinations & PF last, "occasional").

**Flags (UI-only; code kept):**
| Flag | File | Value | Effect |
|---|---|---|---|
| `SHOW_DIAGNOSIS_STEP` | consultation2 page.tsx | `false` | Diagnosis section hidden from nav/Prev-Next and **removed from the completion gate** (`effectiveRequiredSections`); still index 2 for saves |
| `SHOW_REQUIRED_LEFT_BANNER` | consultation2 page.tsx | `false` | Yellow "{n} required sections left… Go to next" banner hidden; gating unchanged |
| `SHOW_DIAGNOSES_TAB` | `lib/templates/urlState.ts` | `false` | Templates "Diagnoses" tab hidden (data untouched) |

**Complete gating:** `REQUIRED_SECTIONS = [0,1,2,3,6]` minus Diagnosis ⇒ effectively **Clinical notes (chief complaint), Vital Signs (default vital templates filled), Prescription (≥1 Rx line incl. unsaved lines, or "no meds" confirmed), Follow-up**. `canComplete` must be true for "Review & complete" (opens a checklist modal) and for "Save amendment". Missing section names are announced (B-40).
- **Follow-up modes:** `dated` (needs a date) · `prn` ("PRN / return if needed"; saved with today's date, reminder off) · `none` ("No follow-up"; deletes any follow-up row). PRN and No follow-up satisfy the gate (`followUpModeSatisfied` in `lib/pf-default.ts`). Reopening a Completed/Amended visit with no follow-up restores "No follow-up".
- **Step icons:** required-but-empty sections show the **warning** icon from page load in editable modes (Nov 20); satisfied ⇒ check; optional ⇒ circle/partial. Read-only completed visits show no warnings.
- **Bottom bar:** Review & complete · Save draft (or Save amendment in amend mode) · small **Prev / Next** buttons (`adjacentSection` in `lib/clinical/consult-steps.ts`; skip hidden Diagnosis; no wrap; Next doesn't save or validate).
- Deep link to a section: `?section=9` or `#section-9` (1-based).
- **Medication acknowledge step was removed.**

**Professional fee (one place: section 9):** editor defaults to **Charge** when nothing is stored (`pfEditorDecisionFromStored` in `lib/clinical/preview-fee.ts`; `initialPfDecision` in `pf-default.ts`); charge amount can prefill from the computed clinic fee (`shouldPrefillChargeAmount`, `computeClinicFee`). Waive needs a reason ≥ 5 chars. Read-only summary line: "Professional fee: Charge ₱… / Waive — reason / Decide at desk". **Known issue:** "Decide at desk" and never-decided are both `null` in the DB. Fee lines (visit type New/FollowUp, Senior/PWD, med cert) are sent with the consultation save; the BE recomputes the booking total.

**Prescription (structured):** `PrescriptionForm.tsx` + `RxTimingFields.tsx`, also in Templates `RxTab.tsx`. Fields per line: generic name, dosage, quantity, instruction (sig), route, **meal relation Before/After**, **timing slots Breakfast/Lunch/Dinner/Bedtime** (stored as comma list in `timing`), **As needed** (`as_needed`), duration (Maintain/Days/Weeks + value), indication. `rx-sig-parse.ts` parses free-text sigs; `rx-structured.ts` `prefillItem` only fills fields the doctor hasn't set. The printed Rx marks these ("smart print").

**Diagnosis:** one ICD-10 field (`Icd10DiagnosisField`) searching the full WHO 2019 list via `GET /api/icd10-codes` (12,221 codes; licence note in BE handoff — **contact licensing@who.int before production**). Currently hidden.

**Medical certificate:** auto-filled — "Examined at" = `MC_EXAMINED_AT_DEFAULT` ("GRACE MEDICAL CLINIC, 3ML Quezon National Highway, Buaya, Lapu Lapu City" from the letterhead), exam dates default to today, address from the patient; patient address field is full width. `mcHasTypedContent` detects real edits.

**Save path (multi-call, not atomic):** consultation upsert → diagnoses → vitals → Rx group → labs → vaccinations → follow-up → med cert (see BE 2-minute diagnoses window). Amend mode sends `Amended`.

---

## 10. Templates (`/doctor/templates`)

- `TemplatesWorkspace` with tabs `soap, phrases, rx, favorites, diagnoses(hidden), certificates`; URL is the source of truth (`?tab=&field=&id=`).
- **One list per doctor.** Built-ins are copied by the BE into her own rows on first load; no System/Mine/Source/Specialty labels; a **"restore" link** calls `POST /api/templates/restore-built-ins?kind=…` to bring back deleted built-ins (`restoreBuiltInTemplates` in `lib/data/clinical.ts`).
- Delete uses `useUndoableDelete` + a toast with **Undo** (toast fixed Nov 20: one card, bottom-center, message/Undo/close inside).
- Edit/create modal centered, `max-w-2xl`, max-h 90vh, sticky header/footer.
- Known: a duplicate diagnosis template "A09.0" may exist (tab hidden; optional cleanup).

---

## 11. Printing & PWA

- **Printing:** `lib/print-forms.ts` (`printPrescription`, `printMedicalCertificate`, `printLabRequest`) → `lib/print-forms-html.ts` (`buildPrescriptionHtml`, `buildMedicalCertificateHtml`, `buildLabRequestHtml`) → `lib/print.ts` (`printHtml`, `escapeHtml`). The letterhead is a hard-coded **`LETTERHEAD`** constant (doctor name, specialty lines, clinic, address, contact, clinic hours) — **not** from clinic settings. Images from `public/forms/` (logo, rx, seal). `consult-print.ts` builds diagnosis/notes text for printouts. (Saturday hours string in LETTERHEAD reads "10:00pm- 5:00pm" — looks like a typo; confirm with Jessie before changing.)
- **PWA:** `app/manifest.ts` (standalone, theme `#00685f`; icons are placeholders), `app/sw.ts` (Serwist; only same-origin navigations, **NetworkOnly** — no page HTML cached because pages are per-user; API/auth/logout never intercepted), served via `/serwist/[path]` with `/sw.js` rewrite and no-cache headers. Offline fallback `/~offline`. SW off in dev unless `NEXT_PUBLIC_ENABLE_SW_DEV=1`. `NetworkStatusBanner` shows offline state; `pwa/clearClientCaches.ts` on logout.

---

## 12. Tests

- **Unit:** `npm run test:unit` = `node --experimental-strip-types --test "src/**/*.test.mjs"`. Tests are mostly source-level/logic tests (they import TS helpers via strip-types/esbuild and assert on page source). **Last known: 235/237 pass.** The 2 failures are **pre-existing** and unrelated: *"P0.4 no UTC-derived date"* and *"privacy consent save never hangs"*.
- Type check: `npx tsc --noEmit`.
- **E2E:** `npm run test:e2e` (Playwright, `e2e/playwright.config.ts`, Chromium, 1 worker, sequential; data tagged `E2E-<runId>`; `setup` project logs roles in). Defaults to FE `:3000` and BE `127.0.0.1:5055` — **which are Jessie's live servers; per his rules you must override `E2E_FE_URL` / `E2E_BE_URL` to separate instances (and not share `.next`).** Dev accounts: `{admin,staff,doctor,patient}@clinic.test` (password in `e2e/README.md`).
- **Likely stale:** `e2e/journeys/consult-simplify.spec.ts:53` opens "3. Diagnosis", which is now hidden — needs updating (don't weaken it; adapt it to the new UI).

---

## 13. FE ↔ BE contract (summary; mirrored in BE handoff)

- **Base URL:** `NEXT_PUBLIC_API_URL` → local `http://localhost:5055` (code default :5000). BE CORS allows localhost/127.0.0.1 :3000 and :3001 in Development.
- **Auth header:** `Authorization: Bearer <clinic_at>`; refresh via `POST /api/auth/refresh-token` (proxy). Shared secret `JWT_SECRET` == BE `Jwt__Secret`; issuer/audience `ClinicApp`.
- **Casing:** snake_case data, camelCase `/api/auth/*`, enums exact names (`PayAtClinic`, `FollowUp`, `CheckedIn`…).
- **Endpoints the FE calls** (from grepping `src`): auth (`login, register, refresh-token, logout, change-password, forgot-password, resend-verification, invite, users/{id}`); `bookings` (`/`, `/{id}`, `/book`, `/me`, `/{id}/cancel|reschedule|status`, `/closed-dates`, `/doctor/today`, `/staff/today`, `/staff/{x}`); `queue` (`/`, `/{id}/{action}`, `/{id}/cancel`); `consultations` (`/`, `/{id}`, `/by-booking/{id}`, `/{id}/diagnoses`); `vitals/by-booking`; `follow-ups/by-consultation`; `lab-orders/by-booking|by-consultation`; `medical-certificates/by-booking|by-consultation`; `patient-vaccinations/by-consultation`; `prescription-groups` (+`/by-booking`); `prescription-templates`; `doctor-favorite-medicines` (+`/order`); `soap-phrases` (+`/order`); `soap-templates`; `medical-certificate-templates`; `doctor-diagnosis-templates`; `templates/restore-built-ins`; `patients` (`/`, `/search`, `/me`, `/{id}`, `/{id}/allergies|consent|consents|consent-decision|export|lab-values`); `payments/{id}/confirm|waive|refund`, `payments/booking/{id}`; `doctors` (`/`, `/search`, `/{id}`, `/{id}/schedules|blocked-dates|day-status`, `/blocked-dates/{id}`, `/day-statuses`); `staff-accounts` (`/`, `/search`, `/me`, `/{id}`); `settings`; `admin/operating-hours`, `admin/payment-methods`; `announcements`; `audit-logs` (+`/search`, `/patient/{id}/access`); `reports/{x}`, `reports/doctor-earnings`; `doctor/performance`; `reviews`; `search`; `privacy/data-requests` (+`/mine`, `/{id}`); `patient-documents` (+`/{id}/file`); `patient-lab-results` (+`/{id}/file`); lookups `medicines`, `vital-field-templates`, `lab-test-catalog`, `icd10-codes`. Full BE list & roles: BE handoff §8.
- Wire shape source of truth: `DOTNET_FRONTEND_CONTRACT.md` (this repo).

---

## 14. Known issues / limitations / security

- Not yet confirmed by Jessie in a browser: one-click logout, centered template modal, the Nov 20 consult changes (Prev/Next, tab warnings, hidden banner), toast fix.
- e2e `consult-simplify.spec.ts:53` stale; 2 pre-existing unit failures.
- PF "Decide at desk" vs undecided both `null`.
- Duplicate "A09.0" diagnosis template (optional cleanup).
- JWT role-change lag ≤ 1 h.
- Consult save is multiple API calls (not atomic).
- PWA icons are placeholders; letterhead is hard-coded.
- **Security:** production-only headers in `next.config.ts` — HSTS (2 years, includeSubDomains), nosniff, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, strict referrer, restrictive Permissions-Policy. `/privacy` public notice (English + Filipino via `/api/public/privacy-notice?lang=fil`). Tokens only in httpOnly cookies; `JWT_SECRET` never `NEXT_PUBLIC_`. All `.env*` gitignored except `.env.example`. `test-results/` is gitignored because captures contain real dev patient records. Supabase keys in `.env.local` are only for legacy scripts — rotate them in Supabase if ever exposed.
- Leftover worktrees from earlier work may exist (`/private/tmp/p02-fe-logout`, `Project02-fe-e2e`) — don't create more; ask Jessie before removing.

---

## 15. Working rules for AI agents (from Jessie — mandatory)

1. **Work directly on `main`.** No new branches, no worktrees. ("please dont complicate my life")
2. Changes must land in the **live running app** (FE on :3000 hot-reloads; BE on :5055 needs a restart Jessie agrees to).
3. **Never commit or push unless Jessie says so** ("push", "psuh it" counts).
4. Stage **explicit paths only** — never `git add .` / `-A`. No force-push, no `--amend`, no rebase, **no `git stash`**, no `checkout`/`reset` of his work.
5. **Never kill processes by name** (no `pkill node`/`killall`).
6. **Never run tests against `:3000` / `:5055`.**
7. **Never commit `.tmp-screens`** (or screenshots/PDFs/prompt files from test runs).
8. Mark every edit `//JJQR <date>` … `//JJQR - END` (seen in code as `//JJQR Nov 20, 2026` or `//JJQR - AI (Nov 20, 2026)`; in JSX `{/* JJQR … */}`).
9. **Every change gets a test; never weaken tests.**
10. Only the **local Docker DB** may be touched, backed up first to `~/Documents/Allyn/db-backups/`; never any work DB.
11. **No new packages without asking.**
12. Never read/print secret values; use variable names.
13. **UI priorities:** phone > tablet > desktop; in-app modals/toasts, never browser `alert/confirm`; **never make the doctor type what the app already knows**; hide rather than delete features (keep code behind a flag, as with Diagnosis).
14. Explain results to Jessie in plain language; say what was and wasn't verified in a browser.
15. Code workflow Jessie uses: Cursor CLI `agent -p --force --model <model>` writes code; supervisor verifies with `npx tsc --noEmit` + `npm run test:unit`.

---

## 16. Where things stand (Nov 20, 2026)

- `main @ 8a9f4d1` (pushed): "Consult: compact Prev/Next buttons beside Save draft; hide required-left banner; warn on empty required tabs from load"; before that `bfa00a6` toast fix, `5865923` centered templates modal + hidden Diagnoses tab, `4357156` print forms, `7d7ceea` amend fix/tab wrap, `4cb1f53` logout proxy, `318ed9a` Rx structured + consult fixes, `2a7a944` simplify merge.
- Working tree clean (before this file was added).
- Open: browser confirmation of recent changes; fix stale e2e spec; optional A09.0 cleanup; WHO licence before production.
