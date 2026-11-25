# HANDOFF — Claude → Grok (25 Nov 2026, Manila time)

Same file in all three repos (`Project02-Desktop`, `Project02-be`, `Project02-fe`), on branch **`handoff/claude-to-grok-2026-11-25`**.
Longer docs (desktop repo): `docs/handoff/00-START-HERE.md` (state + rules), `1-SYSTEM-OVERVIEW.md`, `2-OPERATIONS-RUNBOOK.md`, `5-TODO-AND-RISKS.md`, `6-WEB-DESKTOP-PARITY.md`, `7-OFFLINE-MODE-AUDIT.md`. Where they disagree, **this file, then 00-START-HERE.md** win.
**No passwords, keys or connection strings are in any repo or in this file.** The owner keeps them outside git and types every password himself.

---

## 0. TL;DR (read this if nothing else)
- The system is **LIVE** at a real clinic (Grace Medical Clinic: one doctor and a front desk). The doctor works on the **same Windows laptop** this was developed on.
- **Production is untouched by this handoff.** Backend, web and desktop production are exactly as released on **24 Nov 2026**: desktop **v0.2.45**, backend `main` **e4494a3**, web `main` **bd0f449**.
- **Waiting to ship: desktop v0.2.46 AND the matching web update.** Desktop: every commit after `a0822d1` on the handoff branch (template editor fixes, uploads tagged to a consultation, Reprint, 3 code review rounds, pop-up fixes). **Web:** commit `2e42d58` on the web handoff branch brings the same features to the website (Lab Orders upload 75/25, chart files per visit, Reprint button, Patient chart link). **Backend: no change** (uses existing endpoints).
- **Ship rules:** only after the owner says **"ship"**, and only between **11:00 PM and 12:00 midnight Manila time**.
- **Next step #1:** the owner clicks through v0.2.46 in the test copy (section J). Then ship it in the window.

---

## A. System map

| Repo (github.com/jessiejek/…) | Purpose | Stack | Deploys production when… |
|---|---|---|---|
| `Project02-be` | API + database for everything | ASP.NET Core **.NET 10**, EF Core; **SQL Server** in production (myASP.NET host, USA, FTP upload); **SQLite** for local dev | a **push to `main`**. GitHub Action `deploy-backend.yml` first applies missing EF migrations to the live database (it refuses DROPs unless `allow_destructive_db` is ticked), then FTP-uploads the app. The site is **down for a few seconds**. |
| `Project02-fe` | Web app (admin, staff, doctor, patient portal) | **Next.js 16**, TypeScript, on **Vercel** | a **push to `main`** (Vercel, about 1 min). Other branches only get a Vercel *Preview* copy. |
| `Project02-Desktop` | Desktop app "Clinic Node" for the clinic computers, offline-first | **.NET MAUI 10**: WinUI (Windows, unpackaged) and Mac Catalyst. Folder `ClinicNode/`. Local **SQLite** per computer, synced with the server | a **pushed tag `vX.Y.Z`**. `release-desktop.yml` builds Windows (Inno Setup installer) and Mac in the cloud, signs them and publishes the update feed in `Project02-releases`, in about 20–25 min. **Windows computers update themselves silently.** |
| `Project02-releases` | Public update feed `latest.json` + the last 3 installers | static files | written only by the desktop release workflow. **Not cloned on the Windows PC; not touched in this handoff.** |

**How they connect**
- The web and the desktop both call the backend REST API (JWT sign-in). Live screens use SignalR "live" events (e.g. `PaymentUpdated`).
- **The desktop compiles against the backend's source.** Its projects reference `Project02-be` projects, and the cloud build checks out `Project02-be` **main**. So ship the backend before any desktop release that needs new backend code. (v0.2.46 needs none.)
- The desktop is offline-first:
  - Services are registered `AddOnlineFirst<IInterface, ApiImpl, LocalImpl>`: try the server, and fall back to local SQLite if it can't be reached.
  - `SyncService` pulls and pushes clinic data.
  - Clinic settings reach the desktop through the sync aggregate `clinic_setting`.
  - `SchemaRepair` adds missing local columns automatically.
- **Printing is done locally** on each computer, from its synced SQLite copy. The form layout must match the web **byte for byte**: `Project02-fe/src/lib/print-forms-html.ts` ⇄ `Project02-Desktop/ClinicNode/ClinicNode.Core/Printing/ClinicFormsHtml.cs`, checked by golden tests.
- Patient files (lab results, documents) live **on the server** (`/api/patient-lab-results`, `/api/patient-documents`). The desktop downloads them on demand; they need Online mode.

**Run locally (Windows PC paths: `D:\sidequest\…`)**

| Repo | Command | Notes |
|---|---|---|
| Backend | `dotnet run --project src/ClinicApp.Api --no-launch-profile` with env `ASPNETCORE_ENVIRONMENT=Development`, `Database__Provider=Sqlite`, `ConnectionStrings__DefaultConnection=Data Source=<some temp file>.db`, `Jwt__Secret=<any random 48 bytes, base64>`, `ASPNETCORE_URLS=http://localhost:5055` | Development seeds **fake** accounts `admin@`, `staff@`, `doctor@`, `patient@clinic.test` (password = `DevDataSeeder.DevPassword` in `src/ClinicApp.Infrastructure/DevDataSeeder.cs`; never type it for the owner). Tests: `dotnet test` (see F). |
| Web | `npm install`, then `npm run dev` (needs `NEXT_PUBLIC_API_URL`, see `.env.example`) | `npm run test:unit`, `npm run test:e2e`. ESLint/unit tests can't run on the Windows PC (Node 16 there). |
| Desktop (dev build) | `dotnet build ClinicNode/ClinicNode.App/ClinicNode.App.csproj -f net10.0-windows10.0.19041.0` | Mac: `-f net10.0-maccatalyst` (can only be built on a Mac). Tests: `dotnet test ClinicNode/ClinicNode.Tests` and `dotnet test ClinicNode/ClinicNode.Api.Tests`. **Don't `dotnet test ClinicNode.slnx` on Windows**: it tries the Mac target and errors. |
| Desktop **QA copy** (safe on the doctor's laptop) | separate worktree `D:\sidequest\Project02-Desktop-qa` (its manifest Identity Name is changed to `ph.clinicnode.qa` = its own data folder; **never commit that**). Publish: `dotnet publish ClinicNode/ClinicNode.App/ClinicNode.App.csproj -f net10.0-windows10.0.19041.0 -c Release -r win-x64 --self-contained true -p:WindowsPackageType=None -p:WindowsAppSDKSelfContained=true -p:ClinicWindowsOnly=true -p:ApplicationId=ph.clinicnode.qa -o C:\Users\Public\ClinicNodeQA\app-qa`, then run `ClinicNode.App.exe` with env `CLINIC_NODE_CLOUD_URL=http://localhost:5055` | Talks only to the local fake-data server. The doctor's real app is `C:\Users\<user>\AppData\Local\Programs\Clinic Node\ClinicNode.App.exe`: **never stop or touch it.** |

---

## B. Work done per repo

**How the sessions were told apart:** this Windows PC cloned the repos on 23 Nov (desktop and backend 09:10–09:16, web 24 Nov 19:45). Commits in this clone's reflog marked `commit:` were made by the **Windows Claude session**. Everything else came from GitHub and is attributed to the **Mac Claude session (inferred from git)**.

### Project02-Desktop
**Mac session (inferred from git; the most recent first)**
- 24 Nov (pulled here at 19:45):
  - Hand-over docs `docs/handoff/*` and `CLAUDE.md` (1606bdc).
  - Templates: detach the reused search box (e3ce743).
  - Queue numbers carry on from the last number, with no reserved blocks (504e254).
  - Admin waiver gives no receipt number, and old tests fixed (15deedb).
  - Printing:
    - "Include PTR in print", off by default (009207d, 303620a).
    - A5 default paper (0d05d44).
    - "Preparing the print…" message (c0d9c2e).
    - Licence number printing (c01a63f).
    - Crisp form pictures (733213b).
    - Lab request on A5 with the clinic's tests (93139c0, 67dedc1).
    - Admin > Settings > Printing: clinic-wide print mode and backgrounds, per-document on/off (54b62fe, 31199ca).
  - Set-password wording (215f3b6).
- 23 Nov: Windows crash hardening, "Windows laptop fixes 0.2.29/0.2.30" (ddef562, b308064, a96767b).
- 22–23 Nov, before the clone:
  - OTA update system: signed feed, one-click update, "Updating" page (1b9efe2 … 89385ed).
  - Release CI (fb61e38).
  - Windows Setup.exe through Inno Setup (975065a); Mac DMG (4357886).
  - Profiles: editable name, email and fee (bad301c, f0b86ac, ddd4aae).
  - Speed: HTTP/2, one shared connection pool, parallel loads (9454bd6, 3d7615b).
  - UI polish (3bf6622, df46d86, 69973d6).
  - Sign-in disposed-handler fix (f2d5012).
- Older history: see `git log`. Phases 1–4: offline mode, sync, review items, patient merge.

**Windows session**

| Commit | Date | What | Why |
|---|---|---|---|
| 394cb0a | 23 Nov | Walk-in no longer goes blank after registering or picking a patient; bigger consult work area | WinUI two-parents crash (`_search` reused) |
| 22908cf | 23 Nov | Patient chart visits sorted by date and time, not queue number | owner request |
| e17d154 | 24 Nov | Templates: no crash switching tab / All tabs / Cards (`DetachSearch` before `Clear`) | 0xC000027B on Windows |
| fa7d6f8 | 24 Nov | Doctor: "Walk-In" in the menu (route `doctor-walk-in`); **Cancel booking** with reason radios (Patient left / changed mind / Duplicate / Others + text of 5+ characters) on Today, Appointments and the appointment page (`CancelReasonDialog`); faster "Mark all reviewed" (`ISyncStatus.ResolveConflictsAsync`, one transaction) | owner requests |
| 8250433 | 24 Nov | Admin > Settings > Payments: "Mark the visit paid when the doctor completes it" | owner request |
| 1266b28 | 24 Nov | Admin > Settings > **Consultation**: which parts are required to complete a visit (default Clinical notes; the fee is always required); a follow-up with no date = no follow-up | doctor didn't want vitals required |
| ec1bcf3, a0822d1 | 24 Nov | START-HERE notes for v0.2.44 / v0.2.45 | docs |
| 7665d5b | 25 Nov | Template editor always opens in the app frame and closes however it was opened (`LeaveAsync`; Save failed with "PopAsync is not supported"); opt-in live CRUD QA test `ClinicNode.Api.Tests/TemplatesLiveServerQaTests.cs` (runs only if `CLINIC_QA_SERVER` is a localhost URL) | owner screenshots after Delete |
| 43c28cc | 25 Nov | Review fixes: editor never stays stuck, one redraw per search tap, QA tests clean up after themselves | code review round 1 |
| 93409be | 25 Nov | `StaffDialog` closes first, then answers (`FinishAsync`); `LeaveAsync` returns false → buttons work again; double-tap opens one editor (`_opening`); leftover-dialog cleanup Windows-only and `StaffDialog`-only | code review round 2 (likely root cause of the overlay editor) |
| 5a454cf | 25 Nov | First version of the doctor's upload (PDF/JPG/PNG) + Reprint + "Patient chart" button in the consult header; `IApiClient.UploadAsync` (multipart), `IDoctorPatientsService.UploadFileAsync` | owner request |
| e3b0478 | 25 Nov | `IPrintDocumentFactory.PrescriptionGroupAsync`: print the chosen prescription group (the default is still the newest) | review: a visit with 2 groups printed only the newer one |
| 4bf153a | 25 Nov | **Uploads tagged to ONE consultation**: `ChartFile.BookingId`; consult step 4 **Lab Orders** has "Upload results" in the title bar (1–10 files, 10 MB each), a **75% tests / 25% "Uploaded results"** split; the chart's visit Details has "Results & files" + Upload result / document (not on Cancelled / NoShow / Expired / Rescheduled visits); the Lab Results / Documents tabs show a Visit column and no longer upload; **Reprint button** under "Print patient card" (every prescription, lab request and certificate per visit); "Patient chart" from the consult opens **without** the booking (no Rx edit there); review fixes (no reload storm, timeout warning, file cap, "not on this computer yet" message) | owner: "if I upload to his Nov 25 consult the result is in that consult, not 14, not 24"; code review round 3 |
| dddf74a | 25 Nov | Every pop-up **closes first, then answers**, and Back / X / Esc do nothing while its work is being sent: `CancelReasonDialog`, `RecordPaymentPage`, `QuickRegisterPage`, Reschedule (`StaffBookingDetailPage`), the two Prescription-form dialogs, `AdminDialog`, `ClinicDialog` (shared helper `Views/Staff/ModalClose.cs`) | owner: "I asked you to fix those"; prevents overlays and a possible double payment |
| c06a80b | 25 Nov | START-HERE section 2 updated | docs |

### Project02-be
- **Mac session (inferred from git):**
  - Self-registration closed by default (1e40297, `Registration__PatientSelfSignUp`).
  - Print settings: `print_configs`, lab tests, on/off switches (d555453, 7c94d5d, 91ecd0b).
  - Sync fix for patient code clashes (c8d7537).
  - Set password with no forced change (3031b19, a3ce92f).
  - Privacy-notice audit (81dfed3).
  - Auth rate-limit cap (4f608c6).
  - Profiles and email change (79aa19b).
  - CI: migrate the database before deploy (96e6949, 0c1e16a); gentler FTP (d29346b).
  - Forwarded headers (9f7813e, ca453aa); the doctor's own fee (f1c55b5).
  - Phase 4: review items, patient merge (3e0f3a9 …).
- **Windows session:**
  - **6eee685:** `ClinicSetting.AutoPaidOnComplete` + `PUT api/settings/auto-paid-on-complete` (Admin, audited). `Billing/AutoPaidOnComplete.cs`: when the doctor completes, an Unpaid payment with Amount > 0 becomes Paid, Cash, exact amount, no OR. Called from `QueueController.SetStatus`, which broadcasts `PaymentUpdated`. Tests `AutoPaidOnCompleteTests` (4).
  - **e4494a3:** `ClinicSetting.ConsultRequired` (comma list `notes,vitals,prescription`; null = notes; `""` = fee only) + `PUT api/settings/consult-required` (Admin, audited). **Not enforced by the server**: the web and desktop apply it. Tests `ConsultRequiredTests` (3).
  - A commit "doctor runs the queue online: check in / cancel" (8b936f7) was made and then **reset away** (owner: staff and doctor both add walk-ins; no server change wanted).

### Project02-fe
- **Mac session (inferred from git):**
  - Web prints like the desktop: Admin print settings, PTR off by default, real A5 PDF (82c5719 and earlier print commits).
  - Online patient registration closed (e1de8c1).
  - Set password button (19b52ca).
  - Data Privacy Act notice on registration (df2f206).
  - Profiles (4b0bf3c, 20aaaa9); Admin Sync review page (0fdcda1).
  - Consult always shows every step (2367b13); stale-form protection (3b97d98).
- **Windows session:**
  - **d50f752:** Admin > Settings > Payments tick box (`setAutoPaidOnComplete`).
  - **bd0f449:** Admin > Settings > Consultation tab (Clinical notes / Vital signs / Prescription ticks, Professional fee locked); `consultation2/[bookingId]/page.tsx` uses `requiredSectionsFor(clinicRow?.consult_required)`; `diagnosis-hidden.test.mjs` updated.

---

## C. Database

**How it deploys:** only the backend has a real schema. EF Core migrations live in `Project02-be/src/ClinicApp.Infrastructure/Migrations/`.
- A push to backend `main` runs `deploy-backend.yml`, which generates an idempotent script for **missing** migrations only and applies it to the **live SQL Server** **before** uploading the code. It refuses DROP statements unless the workflow is run by hand with `allow_destructive_db = true`.
- There is a short window where the database is new and the code is still old, so **migrations must be additive**.
- **Local dev:** SQLite (`Database__Provider=Sqlite`), created by the app.
- **Desktop:** each computer has its own SQLite (`clinic-node.db`), and `SchemaRepair` adds missing columns at start-up.
- **No database change is part of v0.2.46.**

| Migration (Project02-be) | What it does | Production |
|---|---|---|
| `20261124143644_AddConsultRequired` | `clinic_settings.consult_required` (nullable text) | **Applied 24 Nov** (backend deploys 145/146) |
| `20261124120624_AddAutoPaidOnComplete` | `clinic_settings.auto_paid_on_complete` (bool, default false) | **Applied 24 Nov** |
| `20261124005004_AddPrintConfig` | `print_configs` table (print mode, backgrounds, lab tests, on/off) | Applied (Mac session, inferred from git: deployed with backend main) |
| `20261122081514_AddPatientMergedInto` | `patients.merged_into_patient_id` | Applied (inferred) |
| `20261122080550_AddSyncReviewItems` | sync review items table | Applied (inferred) |
| `20261121132750_SoapTemplateCategory` … `20261121064610_CloudSync`, `20261121015340_QueueLanes`, `20261120*` and older | cloud sync columns, OR-number unique, queue lanes, ICD-10 WHO list, template copies, Rx as-needed … | Applied (inferred: production runs `main`, and the CI applies every missing migration) |

- Everything on backend `main` is in production. Nothing is pending.
- Rule: **additive only.** If a DROP is ever needed, ask the owner, take a backup, and use the manual workflow with the tick.
- The owner can only run plain SQL (`SELECT` / `DELETE`) in the host's SQL Studio. No transactions, `IF`, `THROW` or `SET`.

---

## D. Desktop

**What changes for users in v0.2.46** (all already committed on the handoff branch)
- **Doctor, consultation:**
  - New **"Patient chart"** button next to "Patient history". It saves first, then opens the chart (read-only for prescriptions).
  - Step **4. Lab Orders** has **Upload results** in the title bar, the tests on the left 75%, and **Uploaded results** on the right 25% (Open buttons).
- **Doctor, patient chart:**
  - Each visit's **Details** has **Results & files**, which shows only that visit's files, with Upload result / Upload document.
  - The **Reprint** button sits under "Print patient card" and opens a list: patient card, and per visit Prescription (1, 2 … when there are several), Lab request and Medical certificate.
  - The Lab Results / Documents tabs show which visit each file belongs to.
- **Templates:** the editor no longer opens full-screen or gets stuck after Delete; a double-tap opens one editor.
- **Every pop-up** (cancel booking, record payment, register patient, reschedule, prescription edit/template, admin dialogs) closes before the screen behind reacts, and can't be dismissed while it's saving.

**Build and packaging**
- **Cloud (the real release):** tag `vX.Y.Z` → `release-desktop.yml`:
  - **Windows job** (`windows-latest`): checks out desktop + backend `main`, MAUI workload, Inno Setup, publish win-x64 self-contained, builds the installer.
  - **Mac job** (`macos-latest`, Xcode 26.0): builds Mac Catalyst, signs the update feed (`UPDATE_SIGNING_KEY`), and publishes `latest.json` + installers to `Project02-releases` (`RELEASES_TOKEN`).
  - Backend checkout uses `BE_READ_TOKEN`.
- `build-windows.yml`: a manual Windows compile check only.
- **Local:** `packaging/windows` (one-script build + Inno Setup), `packaging/mac` (DMG + free signing identity), `packaging/release` (release script). See `packaging/README.md`.
- **Update feed:** `https://raw.githubusercontent.com/jessiejek/Project02-releases/main/latest.json`. GitHub caches it for about 5 min, so check the releases repo commits, not the raw file.

**Desktop-specific config (names only):**
- `CLINIC_NODE_CLOUD_URL` (server address override)
- `CLINIC_NODE_DEMO`
- `CLINIC_NODE_DEV_LOG`
- `CLINIC_NODE_UPDATE_FEED`
- `CLINIC_NODE_TEST_DROP_RESPONSES` (debug builds only)
- `CLINIC_QA_SERVER` (opt-in live QA tests)
- `CLINIC_SYNC_IT_*` (sync integration tests)
- `CLINIC_REALDB_DIR`, `CLINIC_COPY_DIR` (tools)

Release builds default to the live server address, with demo off.

**Data and logs:** `errors.log` and `print-errors.log` sit next to `clinic-node.db` (Windows: the app's data folder; Mac: `~/Library/ClinicNode/`).

---

## E. Releases

**Already in production (shipped 24 Nov 2026):** desktop **v0.2.44** and **v0.2.45**; backend `main` e4494a3 (deploys 145/146); web `main` bd0f449.

**Next release: desktop v0.2.46 + web update (no backend change)**
- **Contents:** desktop commits `7665d5b, 43c28cc, 93409be, 5a454cf, e3b0478, 4bf153a, dddf74a, c06a80b`. The first four are on desktop **local `main`, not pushed**; the last four are on the handoff branch.
- **Backend:** nothing. The uploads use the existing endpoints, and per-group printing is local.
- **Web:** commit `2e42d58` (web handoff branch): same features as the desktop: Lab Orders "Upload results" in the step title bar + 75% tests / 25% "Uploaded results"; chart visit "Results & files" + Upload result / document; Lab Results / Documents tabs show the Visit + Open; "Reprint" button in the chart left panel (each prescription, lab request, medical certificate); "Patient chart" link (new tab) after "View Patient History". Type-check (tsc) clean; **not yet seen in a browser** (Node 16 on the Windows PC cannot run Next 16).
- **Held back / not included:**
  - `SyncResultPage` ("Sync now" progress) still answers before it closes. Left on purpose: it shows the result in place.
  - Mac A5 paper default.
  - Backups schedule.
  - Hosting speed (USA host, 6–9 s per request seen).

**Release order and checklist (run only after the owner says "ship", only 11:00 PM–12:00 AM Manila)**
1. ☐ The owner has clicked through v0.2.46 in the QA copy (J #1), or explicitly said ship anyway.
2. ☐ Desktop repo: `git checkout main`, then `git merge --ff-only handoff/claude-to-grok-2026-11-25`. It is a fast-forward: the branch is `main` + 4 commits + `HANDOFF.md`.
3. ☐ Build on Windows: `dotnet build ClinicNode/ClinicNode.App/ClinicNode.App.csproj -f net10.0-windows10.0.19041.0` → 0 errors.
4. ☐ Tests: `dotnet test ClinicNode/ClinicNode.Tests` and `dotnet test ClinicNode/ClinicNode.Api.Tests`. Expect **only** the known failures (F).
5. ☐ `git tag v0.2.46`, then `git push origin main v0.2.46`.
   - ☐ **Web (same night, same window):** in `Project02-fe`: `git checkout main`, `git merge --ff-only handoff/claude-to-grok-2026-11-25`, then `git push origin main` (Vercel deploys in about 1 min). Check the doctor chart and a consultation in the browser right after. The web branch also adds `HANDOFF.md` to web main: harmless.
   - **Never** `git push --all` / `--tags`.
   - **Don't push backend `main`**: nothing to ship there, and a backend push restarts the live server.
6. ☐ Wait about 20–25 min. Confirm the `Project02-releases` commit shows 0.2.46. Give the owner the installer links.
7. ☐ After the doctor's laptop updates (silently), smoke test after hours: open a consult → Lab Orders → upload; chart → Reprint.
8. ☐ Update `docs/handoff/00-START-HERE.md` section 2 ("SHIPPED …").

**Rollback**
- **Desktop:** publish a **new higher version** from the previous code: `git revert` the bad commits, tag `v0.2.47`, push in the window. (Assumed: the updater installs newer versions only — check the update checker in `ClinicNode` before relying on a lower version.) The v0.2.45 installers stay in `Project02-releases` (the last 3 are kept) for manual reinstall.
- **Backend:** `git revert` on `main` + push (in the window). Migrations are additive, so old code runs on the new schema.
- **Web:** Vercel "Promote" a previous deployment, or revert + push.

**Kept on purpose (don't remove)**

| What | Why |
|---|---|
| `IPrintDocumentFactory.PrescriptionAsync(bookingId)` | default = newest group, still used by the consult screen and Today |
| `IDoctorPatientsService.DownloadFileAsync` / `UploadFileAsync` default methods returning null/false | offline (local) implementation = "needs Online mode" |
| `IApiClient.DownloadAsync` / `UploadAsync` default methods that throw | so test doubles need no change |
| `DoctorPatientChartPage.OpenAsync(…, tab: "reprint")` | opens the Reprint view (no longer a tab) |
| `ConsultSteps` defaults | null `consult_required` = Clinical notes only; the fee is always required |
| Patient self-registration code | closed by `Registration__PatientSelfSignUp=false` (default), not deleted |
| `TemplatesLiveServerQaTests.cs` | opt-in; returns at once unless `CLINIC_QA_SERVER` is set to localhost |

---

## F. Current state

| Area | State |
|---|---|
| Production (backend, web, desktop v0.2.45) | **Working, live.** |
| v0.2.46: upload in Lab Orders, 75/25 split, per-visit files, Reprint button | Built; **the owner saw it in the QA copy and said "perfect"**. |
| v0.2.46: review round 3 fixes, per-prescription print, the 7 pop-up fixes | Built, tests pass, **NOT yet clicked through on screen.** |
| Web update (`2e42d58`): Lab Orders upload, chart files per visit, Reprint, Patient chart link | Built, `tsc` clean; **NOT seen in a browser yet** (Node 16 on the Windows PC). Must be checked before or right after shipping (a Vercel Preview of the web handoff branch can be opened safely; it talks to the live API, so use a test patient only). |
| Desktop tests (Windows) | `ClinicNode.Tests`: 467 pass, **11 fail** (`GoldenParityTests` CRLF line endings on Windows — old, not a regression), 6 skipped. `ClinicNode.Api.Tests`: 132 pass, **1 fail** (`PaperQueueTests.Offline_with_no_reserved_number…`, stale since reserved queue blocks were removed — old). |
| Backend tests | 523 pass, 4 old queue-clash failures (old). |
| Web tests | 13 old consultation-UI failures (old); tsc clean; ESLint can't run on the Windows PC (Node 16). |
| Mac build | **Not verified** for 25 Nov changes (can't build Mac on the Windows PC). The cloud release builds it. |
| Known open issues | ~9 server **403s per page load** on some page (page not identified); Mac print dialog defaults to US Letter; two offline computers can issue the same queue number (flagged); web can't print the PTR; no backup schedule, password-reset email or uptime monitor. |

---

## G. Key files

**Project02-Desktop** (`ClinicNode/…`)

| Path | Purpose |
|---|---|
| `CLAUDE.md`, `docs/handoff/00-START-HERE.md` | rules + live state (section 2 is the running log) |
| `ClinicNode.App/Views/Doctor/ConsultationPage.xaml(.cs)`, `.Ui.cs`, `.Gaps.cs`, `.Safety.cs` | consultation workspace (steps, autosave, print) |
| `ClinicNode.App/Views/Doctor/ConsultationPage.LabUploads.cs` | Lab Orders 75/25 split + "Uploaded results" panel + upload |
| `ClinicNode.App/Views/Doctor/Extra/DoctorPatientChartPage.cs` | patient chart: visits, Results & files, Reprint view |
| `ClinicNode.App/Views/Doctor/Extra/PatientFileUpload.cs` | shared picker + multi-file upload tagged to one visit |
| `ClinicNode.App/Views/Staff/StaffUi.cs` (`StaffDialog`) | shared confirm/input pop-up (close first, then answer) |
| `ClinicNode.App/Views/Staff/ModalClose.cs` | close-then-answer helper for the other pop-ups |
| `ClinicNode.App/Views/Doctor/Extra2/DoctorTemplateEditorPage.cs`, `DoctorTemplatesWorkspacePage.cs` | templates (`LeaveAsync`, `_opening`, `DetachSearch`) |
| `ClinicNode.App/Controls/UiTurn.cs`, `BusyButton.cs` | Windows-safe redraw on the next UI turn; busy buttons |
| `ClinicNode.Api/Http/ApiClient.cs` | HTTP client (JWT refresh, `DownloadAsync`, `UploadAsync`) |
| `ClinicNode.Api/Services/ApiDoctorExtraAppointments.cs` | `ApiDoctorPatientsService` (chart, file up/download) |
| `ClinicNode.Core/DoctorExtra/DoctorPatientsService.cs` | chart records (`ChartFile.BookingId`) + local implementation |
| `ClinicNode.Core/Printing/ClinicFormsPrintDocumentFactory.cs`, `ClinicFormsHtml.cs` | printed forms (must match the web byte for byte) |
| `ClinicNode.App/MauiProgram.cs`, `Doctor/DoctorExtraModule.cs` | DI registration (`AddOnlineFirst`) |
| `.github/workflows/release-desktop.yml` | tag → Mac + Windows release + feed |
| `ClinicNode.Api.Tests/TemplatesLiveServerQaTests.cs` | opt-in live template CRUD QA against a local server |

**Project02-be**

| Path | Purpose |
|---|---|
| `src/ClinicApp.Api/Controllers/SettingsController.cs` | auto-paid + consult-required settings |
| `src/ClinicApp.Api/Controllers/QueueController.cs` | status changes (auto-paid on Completed) |
| `src/ClinicApp.Api/Billing/AutoPaidOnComplete.cs` | marks the payment paid on completion |
| `src/ClinicApp.Api/Controllers/PatientFilesController.cs` | lab result / document upload, list, download (PDF/JPG/PNG, 10 MB, signature check) |
| `src/ClinicApp.Domain/Entities/Admin.cs` | `ClinicSetting` (incl. `AutoPaidOnComplete`, `ConsultRequired`) |
| `src/ClinicApp.Infrastructure/Migrations/` | EF migrations (additive only) |
| `src/ClinicApp.Infrastructure/DevDataSeeder.cs` | fake Development accounts |
| `src/ClinicApp.Infrastructure/QueueSequencer.cs` | queue numbers |
| `.github/workflows/deploy-backend.yml` | push main → migrate live database → FTP |

**Project02-fe**

| Path | Purpose |
|---|---|
| `src/app/admin/settings/page.tsx` | Admin settings (Payments, Consultation, Printing) |
| `src/app/doctor/consultation2/[bookingId]/page.tsx` | web consultation (`requiredSectionsFor`) |
| `src/lib/data/admin.ts` | `setAutoPaidOnComplete`, `setConsultRequired` |
| `src/lib/print-forms-html.ts` | **source of truth** for printed form layout |
| `.env.example` | env names for the web |

---

## H. Config and gotchas

**Environment variable names (never values)**
- **Backend:** `ConnectionStrings__DefaultConnection`, `Database__Provider`, `Jwt__Secret` / `Jwt__Issuer` / `Jwt__Audience`, `Email__*` (SMTP), `ClientBaseUrl`, `Cors__AllowedOrigins`, `FileStorage__*`, `RateLimiting__*`, `Registration__PatientSelfSignUp`, `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`.
  - CI secrets: `DB_PASS`, `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
  - CI vars: `BACKEND_URL`, `FTP_PORT`, `FTP_REMOTE_DIR`.
- **Web:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_TIME`, `NEXT_PUBLIC_SHOW_VERSION`, `NEXT_PUBLIC_LOCAL_NODE`, `NEXT_PUBLIC_ENABLE_SW_DEV`, `CLINIC_LOCAL_NODE`, `JWT_SECRET`, `DOTNET_JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `TZ`.
- **Desktop:** see D. CI secrets: `BE_READ_TOKEN`, `RELEASES_TOKEN`, `UPDATE_SIGNING_KEY`.
- **Ports:** the local QA server uses `http://localhost:5055`.

**Gotchas that cost us time**
1. **WinUI crash patterns** (most "it crashes on Windows" bugs):
   - A control with two parents: detach before `Clear`/re-add.
   - Redrawing inside the handler of a control that the redraw removes: use `UiTurn.Next(...)`.
   - Hard crashes (0xC000027B) do **not** reach `errors.log`. Diagnose with a *temporary* `AppDomain.FirstChanceException` logger in `Platforms/Windows/App.xaml.cs`, and **never commit it**.
2. **A pop-up that answers before it closes:** the caller redraws or navigates under a modal, and Windows shows pages as full-window overlays. Always close first, then answer (`ModalClose` / `StaffDialog.FinishAsync`).
3. **On Windows, `OnAppearing` fires again when any modal closes.** Don't redraw a step in `OnAppearing` unconditionally, or typed text is wiped. See `_backFromChart` in `ConsultationPage`.
4. **Line endings:** files edited with sed/perl on Windows end up LF while git expects CRLF. That's fine to commit (git normalizes), but **`git apply` of a diff into the QA worktree failed silently**. Copy the changed files instead, and **touch their timestamps**, or the incremental build reuses stale DLLs.
5. **Don't `dotnet test ClinicNode.slnx` on Windows** (it tries Mac Catalyst). Test the two projects separately.
6. **The doctor uses the dev laptop during clinic hours.** No on-screen testing then. Use the QA copy + local fake server. **Never stop the doctor's real app.**
7. **Raw `latest.json` is cached** about 5 min; check the releases repo commits instead.
8. **PowerShell 5.1:** no `&&`; quoting breaks commit messages. Use `git commit -F <file>` (UTF-8 **without BOM**).
9. **Deploy gap:** the database migrates before the code uploads, so migrations must work with old code (additive).
10. **Vercel:** any pushed branch gets a Preview build; only `main` is production.

---

## I. Decisions and rules to keep (don't change without asking the owner)

| # | Rule / decision | Why |
|---|---|---|
| 1 | **Never tag, deploy or push `main` without the owner saying "ship" / "release" / "push".** | live clinic |
| 2 | **Shipping only 11:00 PM–12:00 midnight Manila**, even after "ship". | a deploy restarts the server and Windows updates silently mid-consult |
| 3 | **Batch work into one release.** | each release = 20–25 min + a silent update on clinic PCs |
| 4 | **The owner types all passwords**; never type, repeat, log or commit one; no real patient data in logs, commits or tests. | security, privacy law |
| 5 | **Say where a UI control goes in one line, then build exactly that.** | owner preference; he rejects "nearby" placements |
| 6 | Wrap new code in `//JJQR - AI (date) - why … //JJQR - END`. | codebase convention |
| 7 | On Windows, check every redraw for a reused control with an old parent; redraw on the next UI turn. | WinUI crashes |
| 8 | Plain English, short bullets, show proof before saying "done". | owner is not a programmer |
| 9 | **Staff AND doctor can both add walk-ins** (doctor via the menu "Walk-In"); the server's check-in/cancel rules were **not** widened. | owner: "that's the deal" |
| 10 | Cancel booking uses reason radios; "Others" enables a text box (5+ characters). | owner request |
| 11 | Auto-paid on complete is an **Admin switch, off by default**; marks Cash, exact amount, no OR. | owner request |
| 12 | Consultation required parts are Admin-configurable; **default = Clinical notes + fee; vitals not required; fee always required; a follow-up with no date = no follow-up.** | the doctor doesn't want vitals required |
| 13 | **Every uploaded file belongs to exactly one consultation (visit).** Uploads happen in that visit (chart visit Details) or in the consult's Lab Orders step, never "to the latest visit". Not on Cancelled / NoShow / Expired / Rescheduled visits. | owner: "Nov 25 result stays in Nov 25" |
| 14 | Lab Orders layout: **Upload results in the step title bar; 75% tests / 25% uploads.** 1–10 files, PDF/JPG/PNG, 10 MB each. | owner choice |
| 15 | **Reprint = a button under "Print patient card"** in the chart's left panel (not a tab). | owner choice |
| 16 | "Patient chart" from the consult opens **without** the booking (no prescription editing there). | prevents the consult autosave overwriting chart edits |
| 17 | Pop-ups close first, then answer; no dismiss while their work is sending. | Windows overlays, duplicate uploads, double payments |
| 18 | Printed forms: web `print-forms-html.ts` is the source of truth; the desktop must match byte for byte. | golden tests |
| 19 | Database migrations additive only; DROPs need the owner + a backup + the manual workflow tick. | live data |
| 20 | Never touch a database directly for QA; use the app UI or the local fake server. Test scripts in the repo must be opt-in and localhost-only. | live data |
| 21 | The QA copy (`ph.clinicnode.qa`) and its manifest change are **never committed**. | it would change the real app's identity |

---

## J. Next steps (priority order)

1. **Web check:** open the Vercel *Preview* of the web handoff branch (or run the web locally with Node 20+). Check the doctor chart (Reprint, visit Results & files, Upload) and a consultation Lab Orders step (Upload results, 75/25). Use a TEST patient only: the Preview talks to the live API.
1. 1. **Owner click-through of v0.2.46 in the QA copy** (after clinic hours, or while the doctor isn't using the laptop).
   - Start the local server and QA app (A).
   - Things to try:
     - consult → Lab Orders → Upload results (1 file, then 3 files; Cancel is blocked while sending);
     - chart → visit Details → Upload result; the file appears only in that visit;
     - chart → Reprint → print the patient card, Prescription 1 / 2, lab request, certificate (sample visit: fake patient "Ana Santos", 25 Nov);
     - Cancel booking, Record payment, Reschedule, Register a new patient, Prescription edit/template, an Admin dialog: each closes cleanly, with no full-window overlay;
     - Templates: delete then edit, double-tap.
   - Fix anything he reports on the handoff branch.
2. **Ship desktop v0.2.46 + the web update** with the checklist in E (no backend push). Only after "ship", only 11 PM–midnight.
3. **After the update reaches the doctor's laptop:** a quick smoke test after hours, then update START-HERE section 2.
4. **Make the Windows test run green:**
   - `GoldenParityTests`: normalize line endings, e.g. `.gitattributes` `*.json text eol=lf` for the golden files, or compare ignoring `\r`.
   - Update or delete the stale `PaperQueueTests` case (reserved queue blocks no longer exist).
5. **Find the page causing ~9 server 403s per load:** watch the network calls per page, then hide or skip the calls the role isn't allowed to make.
6. **Decide on `SyncResultPage`:** it answers before it closes, probably on purpose. Confirm with the owner and align with `ModalClose` if needed.
7. **Open items from START-HERE section 6:** Mac A5 default, backup schedule (tools in `accounts-tools`; the owner runs them), password-reset email, uptime monitor, faster hosting.

---

## Starter prompt for Grok (copy everything below this line)

> You are taking over a LIVE clinic system from Claude. Before doing anything:
> 1. In each repo — `Project02-Desktop`, `Project02-be`, `Project02-fe` (github.com/jessiejek) — check out branch `handoff/claude-to-grok-2026-11-25` and read `HANDOFF.md` fully, then `Project02-Desktop/docs/handoff/00-START-HERE.md` and `Project02-Desktop/CLAUDE.md`.
> 2. Confirm what is already done (sections B, E, F) — **do not redo finished work** and do not rewrite working code.
> 3. Treat every rule and decision in **section I as fixed**. If you think one should change, ask the owner first; never change it on your own.
> 4. Never push to `main`, never push a tag, never deploy, unless the owner says "ship" — and even then only between 11:00 PM and 12:00 midnight Manila time. Push only the exact branch name: `git push origin handoff/claude-to-grok-2026-11-25`. Never `git push --all` or `--tags`.
> 5. The owner types all passwords. Never ask for, print, store or commit passwords, tokens, keys, connection strings or real patient data.
> 6. The doctor uses the Windows dev laptop during clinic hours: no on-screen testing then, never stop her app; use the QA copy and the local fake-data server (section A).
> 7. Answer the owner in plain English with short bullets; say exactly where any UI control goes before building it.
> Then start with **section J, next step #1**: tell the owner what to click through in the QA copy for v0.2.46, help him run it, and fix what he finds on the handoff branch.
