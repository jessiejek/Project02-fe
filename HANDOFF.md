# HANDOFF — Claude → Grok (final version, 25 Nov 2026 evening, Manila time)

This is the same file in all three repos (`Project02-Desktop`, `Project02-be`, `Project02-fe`), on branch **`handoff/claude-to-grok-2026-11-25`**.

**Reading order:**
1. This file.
2. `Project02-Desktop/docs/handoff/00-START-HERE.md`. Its section 2 was rewritten to match this file.
3. `Project02-Desktop/CLAUDE.md`.

**Older long docs** (`1-SYSTEM-OVERVIEW.md`, `2-OPERATIONS-RUNBOOK.md`, `5-TODO-AND-RISKS.md`, `6-WEB-DESKTOP-PARITY.md`, `7-OFFLINE-MODE-AUDIT.md`) are background only. **If anything disagrees, this file wins.**

**No passwords, keys or connection strings are in any repo or in this file.** The owner types every password himself.

**Section K answers every question asked so far. If something isn't covered here, say "not found" and ask the owner; don't guess.**

---

## 0. TL;DR

- The system is **LIVE** at Grace Medical Clinic (one doctor and a front desk). **The doctor works on the same Windows laptop** where this was developed.
- **Production right now** (shipped 24 Nov 2026, untouched since):

  | Part | Live version |
  |---|---|
  | Desktop | **v0.2.45** (tag on commit `a0822d1`) |
  | Backend | `main` = **`e4494a3`** |
  | Web | `main` = **`bd0f449`** |

- **Next release = desktop v0.2.46 + a web update. The backend has NO change.** All the work is committed on the handoff branches, which are already pushed to GitHub.
- **Ship rules:**
  - only when the owner says **"ship"**;
  - only between **11:00 PM and 12:00 midnight Manila**;
  - **never 8:00 AM–9:00 PM**, even if he insists. Refuse and remind him (rule I-2).
- **Your first job (J-1):** help the owner check the web change in a Vercel **Preview**, and click through the desktop change in the **QA copy**. Fix what he finds on the handoff branches. Then ship in the window, with the checklist in E.

---

## A. System map

| Repo (github.com/jessiejek/…) | Purpose | Stack | What deploys production |
|---|---|---|---|
| `Project02-be` | API + database | ASP.NET Core **.NET 10**, EF Core. **SQL Server** in production (myASP.NET host, USA, FTP upload). **SQLite** for local dev. | A **push to `main`**. GitHub Action `deploy-backend.yml` applies missing migrations to the live database first (it refuses DROPs unless run by hand with `allow_destructive_db`), then uploads the app over FTP. **The live server is down for a few seconds.** |
| `Project02-fe` | Website (admin, staff, doctor, patient portal) | **Next.js 16**, TypeScript, **Vercel** | A **push to `main`** (about 1 min). Any other pushed branch only gets a Vercel *Preview* at a separate address. |
| `Project02-Desktop` | Desktop app "Clinic Node" for clinic computers, offline-first | **.NET MAUI 10**: WinUI (Windows, unpackaged; **the only platform users run**) + Mac Catalyst (still built by the release, not used). Folder `ClinicNode/`. Each computer has its own **SQLite**, synced with the server. | A **pushed tag `vX.Y.Z`** → `release-desktop.yml` (about 20–25 min). **Windows computers update themselves silently.** |
| `Project02-releases` | Public update feed `latest.json` + the last 3 installers | static files | Written **only** by the desktop release workflow (force-push to its `main`). Never touch it by hand. Not cloned on the Windows PC. |

**Who uses what (owner, 25 Nov 2026)**
- The clinic is **Windows only**: the doctor and front desk use the **Clinic Node desktop app on Windows**.
- The doctor also wants to use an **iPad**: there is **NO iPad app**. On the iPad she uses the **WEBSITE in Safari**.
- **Mac is NOT a user platform.** The release workflow still builds a Mac version (D), but nobody uses it.
- **All dev/QA work happens on the owner's Windows laptop** (`D:\sidequest\…`). The owner's Mac ("MacBoy") is no longer part of the workflow; a Mac build result is **no longer a workflow step**.

**How they connect**
- The web and the desktop both call the backend REST API (JWT sign-in), plus SignalR live events.
- **The desktop compiles against the backend's source.** Its projects reference `Project02-be`, and the cloud build checks out backend **`main`**. If a desktop change ever needs backend code, ship the backend first. **v0.2.46 needs none.**
- **Desktop offline-first design:**
  - `AddOnlineFirst<IInterface, ApiImpl, LocalImpl>`: try the server, and fall back to local SQLite if it can't be reached.
  - `SyncService` pulls and pushes clinic data.
  - `SchemaRepair` adds missing local columns.
  - Clinic settings reach the desktop through the sync aggregate `clinic_setting`.
- **Printing** is done locally on each computer: the desktop prints from its synced SQLite, the web from the API. The form layout must match **byte for byte** between web `src/lib/print-forms-html.ts` and desktop `ClinicNode.Core/Printing/ClinicFormsHtml.cs` (golden tests).
- **Patient files** (lab results, documents) are stored **on the backend server's disk**, never in Git, Vercel or the desktop.
  - Folder: `App_Data/uploads/<patientId>/<bookingId>/<unixMillis>-<sanitizedName>`.
  - The original name, title, visit and uploader are in the database tables `patient_lab_results` / `patient_documents`.
  - The deploy (`deploy/publish.sh`) uploads files one by one and **never deletes or mirrors** that folder.
  - **There is no backup schedule yet.**

**Run locally** (Windows PC paths: `D:\sidequest\…`)

| What | How | Notes |
|---|---|---|
| Backend | `dotnet run --project src/ClinicApp.Api --no-launch-profile` with env `ASPNETCORE_ENVIRONMENT=Development`, `Database__Provider=Sqlite`, `ConnectionStrings__DefaultConnection=Data Source=<temp file>.db`, `Jwt__Secret=<random 48 bytes, base64>`, `ASPNETCORE_URLS=http://localhost:5055` | Development seeds **fake** accounts `admin@ / staff@ / doctor@ / patient@clinic.test`. Their password is the constant `DevPassword` in `src/ClinicApp.Infrastructure/DevDataSeeder.cs`. Never type it for the owner; point him to the file. |
| Web | `npm install`, then `npm run dev` (env names in `.env.example`) | Needs **Node 20+**. The Windows PC has Node 16: `npx tsc --noEmit -p .` works, but `next dev` and `npm run test:unit` don't. |
| Desktop dev build | `dotnet build ClinicNode/ClinicNode.App/ClinicNode.App.csproj -f net10.0-windows10.0.19041.0` | Mac target only on a Mac. Tests: `dotnet test ClinicNode/ClinicNode.Tests` and `dotnet test ClinicNode/ClinicNode.Api.Tests`. **Never `dotnet test ClinicNode.slnx` on Windows** (it tries the Mac target and errors). |
| **Desktop QA copy** (safe on the doctor's laptop) | Worktree `D:\sidequest\Project02-Desktop-qa`. Its `Platforms/Windows/Package.appxmanifest` Identity Name is changed to `ph.clinicnode.qa` (own data folder; **never commit that**). Copy changed files in from the main checkout **and touch their timestamps**, then publish: `dotnet publish ClinicNode/ClinicNode.App/ClinicNode.App.csproj -f net10.0-windows10.0.19041.0 -c Release -r win-x64 --self-contained true -p:WindowsPackageType=None -p:WindowsAppSDKSelfContained=true -p:ClinicWindowsOnly=true -p:ApplicationId=ph.clinicnode.qa -o C:\Users\Public\ClinicNodeQA\app-qa`. Run `C:\Users\Public\ClinicNodeQA\app-qa\ClinicNode.App.exe` with env `CLINIC_NODE_CLOUD_URL=http://localhost:5055`. | Talks only to the local fake-data backend. **The doctor's real app is `%LOCALAPPDATA%\Programs\Clinic Node\ClinicNode.App.exe`. Never stop or touch it.** When stopping a QA app, filter processes by the path `C:\Users\Public\ClinicNodeQA\`. |
| Sample data (QA server) | Fake patient **"Ana Santos"** has a visit on **2026-11-25** with 2 prescription lines, a lab request (CBC, Chest X-ray PA) and an issued medical certificate. That visit also has test uploads. | Only on the local SQLite QA database (Claude's temporary folder). It may not exist on another machine; recreate it through the app if needed. |

---

## B. Work done per repo

**How the sessions were told apart (inferred from git):**
- The Windows PC cloned the repos on 23 Nov (desktop and backend 09:10–09:16, web 24 Nov 19:45).
- Commits recorded as `commit:` in this clone's reflog = **Windows Claude session**.
- Everything that came from GitHub = **Mac Claude session**.

### Project02-Desktop

**Mac session (inferred from git), newest first**
- **24 Nov**, pulled here at 19:45:
  - Hand-over docs + `CLAUDE.md` (1606bdc).
  - Templates search-box detach (e3ce743).
  - Queue numbers carry on from the last number, with no reserved blocks (504e254).
  - Admin waiver gives no receipt number (15deedb).
  - Print work: "Include PTR in print", off by default (009207d, 303620a); A5 default (0d05d44); "Preparing the print…" (c0d9c2e); licence number (c01a63f); crisp form pictures (733213b); lab request on A5 with the clinic's tests (93139c0, 67dedc1); Admin > Settings > Printing (54b62fe, 31199ca).
  - Set-password wording (215f3b6).
- **23 Nov:** Windows crash hardening, "0.2.29/0.2.30" (ddef562, b308064, a96767b).
- **22–23 Nov:**
  - OTA updates: signed feed, one-click update, Updating page (1b9efe2 … 89385ed).
  - Release CI (fb61e38); Windows Setup.exe (975065a); Mac DMG (4357886).
  - Profiles (bad301c, f0b86ac, ddd4aae).
  - Speed: HTTP/2, shared connection pool (9454bd6, 3d7615b).
  - UI polish (3bf6622, df46d86, 69973d6).
  - Sign-in fix (f2d5012).
- Older: phases 1–4 (offline mode, sync, review items, patient merge). See `git log`.

**Windows session**

| Commit | Date | What | Why |
|---|---|---|---|
| 394cb0a | 23 Nov | Walk-in no longer goes blank after registering or picking a patient; bigger consult area | WinUI two-parents crash |
| 22908cf | 23 Nov | Chart visits sorted by date and time | owner |
| e17d154 | 24 Nov | Templates: no crash switching tab / All tabs / Cards | 0xC000027B |
| fa7d6f8 | 24 Nov | Doctor "Walk-In" in the menu; Cancel booking with reason radios (Patient left / changed mind / Duplicate / Others + 5+ characters) on Today, Appointments and the appointment page; faster "Mark all reviewed" | owner |
| 8250433 | 24 Nov | Admin > Settings > Payments: mark paid when the doctor completes | owner |
| 1266b28 | 24 Nov | Admin > Settings > Consultation: which parts are required (default Clinical notes; fee always) | doctor didn't want vitals required |
| ec1bcf3, a0822d1 | 24 Nov | START-HERE notes v0.2.44 / v0.2.45 (**a0822d1 = v0.2.45 = GitHub `main`**) | docs |
| 7665d5b | 25 Nov | Template editor opens in the app frame and closes however it was opened (`LeaveAsync`); opt-in QA `TemplatesLiveServerQaTests.cs` | "PopAsync is not supported" after Delete |
| 43c28cc | 25 Nov | Review round 1 fixes (editor never stuck, one redraw, QA cleanup) | code review |
| 93409be | 25 Nov | Review round 2: `StaffDialog` closes first, then answers; `LeaveAsync` un-sticks; one editor per double-tap | likely root cause of the overlay editor |
| 5a454cf | 25 Nov | First version of upload + Reprint + "Patient chart" button; `IApiClient.UploadAsync`, `IDoctorPatientsService.UploadFileAsync` | owner |
| e3b0478 | 25 Nov | `IPrintDocumentFactory.PrescriptionGroupAsync`: print one chosen prescription group | review: only the newest group printed |
| 4bf153a | 25 Nov | **Uploads tagged to ONE consultation**: `ChartFile.BookingId`; Lab Orders "Upload results" in the title bar + 75/25 split; chart visit "Results & files"; no uploads on dead visits; Reprint button in the left panel; "Patient chart" opens without the booking; review round 3 fixes | owner: "Nov 25 result stays in Nov 25" |
| dddf74a | 25 Nov | All pop-ups close first, then answer, and can't be dismissed while sending (`ModalClose.cs`) | owner: "I asked you to fix those" |
| c06a80b, 3c17dc2 … 895dceb, 01947a4 | 25 Nov | START-HERE + HANDOFF.md | docs |
| 5560dd1 | 25 Nov (Grok) | START-HERE rule 8: say the Manila time before every ship step; never ask "are you sure?" | owner |
| 2283986 | 25 Nov (Grok) | `PatientFileUpload.cs`: several files with no suggested title pre-fill **"Lab results <visit date>" / "Documents <visit date>"** (still editable; "(1 of 3)" per file). Same rule as the web. **Not compiled yet** (box is Linux): build-check on the Windows laptop (dev build + QA copy) | owner, J-1 finding |

**Local `main` = `5a454cf`** (4 commits ahead of GitHub `main` `a0822d1`; never pushed). **Handoff branch = local `main` + everything after**, pushed.

### Project02-be
- **Mac session (inferred from git):**
  - Self-registration closed by default (1e40297, `Registration__PatientSelfSignUp`).
  - Print settings table and endpoints (d555453, 7c94d5d, 91ecd0b).
  - Sync code-clash fix (c8d7537).
  - Set password (3031b19, a3ce92f); privacy-notice audit (81dfed3); auth rate-limit cap (4f608c6); profiles (79aa19b).
  - CI migrates the database before deploy (96e6949, 0c1e16a); gentler FTP (d29346b); forwarded headers (9f7813e); the doctor's own fee (f1c55b5); phase 4 review items and patient merge.
  - The **patient file upload endpoints** are older: `0706866`, **9 Sep 2026**, last changed 20 Nov.
- **Windows session:**
  - **6eee685:** auto-paid on complete (`ClinicSetting.AutoPaidOnComplete`, `PUT api/settings/auto-paid-on-complete`, `Billing/AutoPaidOnComplete.cs`, 4 tests).
  - **e4494a3:** `ClinicSetting.ConsultRequired` + `PUT api/settings/consult-required` (3 tests; **not enforced by the server**, the apps apply it).
  - A commit widening doctor check-in/cancel on the server (8b936f7) was **reset away**. The owner didn't want it.
- **25 Nov: no backend code change at all.** The handoff branch adds only `HANDOFF.md`.

### Project02-fe
- **Mac session (inferred from git):**
  - Web prints like the desktop (82c5719 and earlier).
  - Online registration closed (e1de8c1); Set password (19b52ca); privacy notice (df2f206).
  - Profiles (4b0bf3c, 20aaaa9); Sync review page (0fdcda1).
  - Consult shows all steps (2367b13); stale-form protection (3b97d98).
- **Windows session:**
  - **d50f752:** Payments tick box.
  - **bd0f449:** Consultation tab (= live web `main`).
  - **25 Nov, on the handoff branch:**
    - **`2e42d58`:** the desktop's upload / Reprint features on the website.
    - **`682d9e2`:** web code review fixes (8 findings).
    - **`4d033ac` (Grok, 25 Nov):** several files with no suggested title pre-fill "Lab results <visit date>" / "Documents <visit date>" (`lib/visit-upload.ts` `defaultUploadTitle`, same rule as the desktop); upload times shown in **Manila time** (`formatUploadedManila`, `timeZone: "Asia/Manila"`) in the Lab Orders "Uploaded results" panel and the chart's Results & files line (were raw UTC); 2 new tests.
    - **`05e9770` (Grok, 25 Nov):** fixed the 2 ESLint `react-hooks/set-state-in-effect` errors (`VisitFilesPanel.tsx`, chart Reprint check in `doctor/patients/[id]/page.tsx`): the state reset now runs right after the effect instead of inside it. No behavior change; eslint 0 errors on the touched files, `tsc` clean, same 13 old test failures.
    - Plus `HANDOFF.md` commits.

---

## C. Database

**How it deploys**
- Only the backend has a real schema: EF Core migrations in `Project02-be/src/ClinicApp.Infrastructure/Migrations/`.
- A push to backend `main` applies the **missing** migrations to the live SQL Server **before** uploading the code. Because of that window, **migrations must be additive.**
- Local dev uses SQLite. Each desktop has its own SQLite `clinic-node.db`, kept in shape by `SchemaRepair`.
- **No database change is part of the next release.**

| Migration (Project02-be) | What | Production |
|---|---|---|
| `20261124143644_AddConsultRequired` | `clinic_settings.consult_required` (nullable text) | **Applied 24 Nov** (deploys 145/146) |
| `20261124120624_AddAutoPaidOnComplete` | `clinic_settings.auto_paid_on_complete` (bool, default false) | **Applied 24 Nov** |
| `20261124005004_AddPrintConfig` | `print_configs` table | Applied (inferred from git: on `main`, and CI applies all missing migrations) |
| `20261122081514_AddPatientMergedInto`, `20261122080550_AddSyncReviewItems` | patient merge, sync review items | Applied (inferred) |
| `20261121*`, `20261120*` and older | cloud sync, OR-number unique, queue lanes, ICD-10, templates, Rx as-needed … | Applied (inferred) |

- Rules: **additive only.** A DROP needs the owner's OK, a backup, and the manual workflow tick.
- The owner can only run plain `SELECT`/`DELETE` in the host's SQL Studio (no transactions, `IF`, `THROW` or `SET`).

---

## D. Desktop

**What users get in v0.2.46**
- **Consultation:**
  - **"Patient chart"** button right after "Patient history". It saves first, then opens the chart **without** the booking, so prescriptions are read-only there.
  - Step **4. Lab Orders**: **"Upload results"** in the title bar; tests on the left 75%, **"Uploaded results"** on the right 25%.
- **Patient chart:**
  - Each visit's Details has **"Results & files"** (that visit only), with Upload result / Upload document.
  - The **Reprint** button sits under "Print patient card" (left panel).
  - The Lab Results / Documents tabs show which visit each file belongs to.
- **Templates:** no stuck or full-screen editor; a double-tap opens one editor.
- **Every pop-up** closes before the screen behind reacts, and can't be dismissed while saving.

**Build and packaging**
- **Release workflow `release-desktop.yml`** (tag `v*`), all-or-nothing:
  1. **Job `windows`** (`windows-latest`): checks out desktop + backend `main`, MAUI workload, Inno Setup, publish win-x64 self-contained, installer saved as an artifact.
  2. **Job `mac`** (`needs: windows`, `macos-latest`, Xcode 26.0): builds Mac Catalyst, signs `latest.json` (`UPDATE_SIGNING_KEY`), and **only as its last step** force-pushes the feed + installers to `Project02-releases` (`RELEASES_TOKEN`).
  - So **if the Windows job fails, the Mac job never runs; if the Mac job fails, nothing is published.** No half release.
  - **This means a Mac build failure blocks Windows updates too**, even though nobody uses the Mac app (A). **Keep the workflow as it is for now.** A Windows-only release workflow is a later job and **needs the owner's OK** first.
  - Backend checkout uses `BE_READ_TOKEN`.
- `build-windows.yml` is a manual Windows compile check only. It publishes nothing.
- **There is no safe Mac compile check without publishing.** Starting the release workflow by hand publishes. The Mac build of the 25 Nov changes will first be tried during the release, and the all-or-nothing design covers that (if it fails: nothing ships; fix and tag again, or ask the owner about the Windows-only workflow).
- Local scripts: `packaging/windows` (Inno Setup), `packaging/mac` (DMG + signing identity), `packaging/release`. See `packaging/README.md`.
- **Updater:** `ClinicNode.Core/Update/UpdateChecker.cs` installs **only a higher version** (`latest > current`). A rollback must be a **new higher version**.
- Feed: `https://raw.githubusercontent.com/jessiejek/Project02-releases/main/latest.json`. It's cached for about 5 min, so check the releases repo commits instead.

**Desktop config names:**
- `CLINIC_NODE_CLOUD_URL` (server address)
- `CLINIC_NODE_DEMO`
- `CLINIC_NODE_DEV_LOG`
- `CLINIC_NODE_UPDATE_FEED`
- `CLINIC_NODE_TEST_DROP_RESPONSES` (debug builds only)
- `CLINIC_QA_SERVER` (opt-in live QA tests, localhost only)
- `CLINIC_SYNC_IT_*`
- `CLINIC_REALDB_DIR`, `CLINIC_COPY_DIR`

Release builds default to the live server address, with demo off.

**Logs:** `errors.log` and `print-errors.log` sit next to `clinic-node.db` (Windows: the app's data folder; Mac: `~/Library/ClinicNode/`).

---

## E. Releases

**Live (shipped 24 Nov 2026):** desktop v0.2.44 → **v0.2.45**; backend `e4494a3`; web `bd0f449`.

**Next release: desktop v0.2.46 + web update. NO backend change.**

| Part | What ships | Branch / commits |
|---|---|---|
| Desktop v0.2.46 | `7665d5b, 43c28cc, 93409be, 5a454cf` (local `main`) + `e3b0478, 4bf153a, dddf74a, 2283986` (code) + docs | `handoff/claude-to-grok-2026-11-25` (desktop) |
| Web | `2e42d58` (features) + `682d9e2` (review fixes) + `4d033ac` (upload title + Manila times) + `05e9770` (lint fix) + `HANDOFF.md` | `handoff/claude-to-grok-2026-11-25` (web) |
| Backend | **nothing.** Don't merge or push its `main`: a push restarts the live server, and its branch only adds `HANDOFF.md` | — |

**Held back on purpose:**
- `SyncResultPage` ("Sync now" progress) still answers before it closes. It shows the result in place; decide with the owner.
- Server-side enforcement of the app-only upload rules (no dead visits, max 10 files, title required). The server already enforces the visit, the patient, the type, the 10 MB limit and access.
- Mac A5 paper default; backups; faster hosting.

**Checklist (only after "ship", only 11:00 PM–12:00 midnight Manila; say the current Manila time before each step)**
1. ☐ Steps J-1 and J-3 (desktop QA copy) are done, or the owner explicitly said ship anyway. J-2 (iPad check) is done on the Preview before the ship, or right after it on production (test patient only).
2. ☐ **Desktop:**
   - `git fetch`; confirm GitHub `main` is still `a0822d1` and local `main` is `5a454cf`.
   - `git checkout main`, then `git merge --ff-only handoff/claude-to-grok-2026-11-25`.
3. ☐ Build: `dotnet build ClinicNode/ClinicNode.App/ClinicNode.App.csproj -f net10.0-windows10.0.19041.0` → 0 errors.
4. ☐ Tests: `dotnet test ClinicNode/ClinicNode.Tests` and `dotnet test ClinicNode/ClinicNode.Api.Tests` → only the known failures (F).
5. ☐ `git tag v0.2.46`, then `git push origin main v0.2.46`.
   - Exact refs: allowed. **Never** `--all` / `--tags`.
   - Wait about 20–25 min, then confirm a new `Project02-releases` commit with 0.2.46, and give the owner the installer links.
6. ☐ **Web, same window:** in `Project02-fe`: `git fetch`; confirm `main` = `bd0f449`; `git checkout main`; `git merge --ff-only handoff/claude-to-grok-2026-11-25`; `git push origin main`. Vercel deploys in about 1 min. Check the doctor chart and a consultation's Lab Orders right after.
7. ☐ **Do NOT touch backend `main`.**
8. ☐ After the doctor's laptop updates (silently), a quick smoke test after hours, then update START-HERE section 2 ("SHIPPED …").

**Rollback**
- **Desktop:** `git revert` the bad commits, tag **v0.2.47** (it must be higher; see D), and push in the window. The v0.2.45 installer stays in `Project02-releases` for a manual reinstall.
- **Web:** Vercel → Deployments → **Promote** the previous production deployment (instant), or revert + push.
- **Backend:** nothing shipped. If ever needed: revert on `main` + push in the window (migrations are additive).

**Kept on purpose (don't remove)**

| What | Why |
|---|---|
| `IPrintDocumentFactory.PrescriptionAsync(bookingId)` | default = newest group; the consult screen and Today use it |
| Default interface methods: `IDoctorPatientsService.DownloadFileAsync` / `UploadFileAsync` (return null / false), `IApiClient.DownloadAsync` / `UploadAsync` (throw) | the offline local implementation means "needs Online mode"; test doubles need no change |
| `DoctorPatientChartPage.OpenAsync(…, tab: "reprint")` | opens the Reprint view (not a tab) |
| `ConsultSteps` defaults | null `consult_required` = Clinical notes; the fee is always required |
| Patient self-registration code | closed by `Registration__PatientSelfSignUp=false`, not deleted |
| `TemplatesLiveServerQaTests.cs` | opt-in; returns at once unless `CLINIC_QA_SERVER` is a localhost URL |

---

## F. Current state

| Area | State |
|---|---|
| Production (desktop v0.2.45, backend, web) | **Working, live.** |
| Desktop: upload in Lab Orders, 75/25, chart files per visit, Reprint | Built; **the owner saw it in the QA copy and said "perfect"**. |
| Desktop: review round 3 fixes, per-prescription print, 7 pop-up fixes, template fixes | Built, tests pass, **NOT clicked through on screen.** |
| Web `2e42d58` + `682d9e2` + `4d033ac` | **J-1 done 25 Nov on a LOCAL fake-data stack** (Linux box: backend Development + SQLite on :5055, web on :3000, web `main` on :3001 for comparison; never the live API or Preview). Passed: Lab Orders "Upload results" top right + 75/25; 1 then 3 files, pop-up can't close while sending; "Patient chart" opens in a new tab and the panel reloads on return; chart Results & files per visit; no Upload on a cancelled visit; Lab Results / Documents Visit column + Open; Reprint lists prescription / lab request / certificate; narrow window shows tests first. **Two fixes made** (`4d033ac`): pre-filled title for several files; Manila upload times (proof: API `2026-11-25T09:28:43Z` shows "Uploaded 2026-11-25 17:28", also in a UTC browser). Web unit tests (Node 24): 328 tests, 315 pass, **13 fail = exactly the same 13 as web `main`**; `tsc` clean. ESLint: 2 `react-hooks/set-state-in-effect` errors in `VisitFilesPanel.tsx` / chart `page.tsx` from `2e42d58`/`682d9e2` (not from `4d033ac`; Next build does not run ESLint). **Prescription 1 / 2 on the web could not be tested**: the server keeps ONE prescription group per visit (see open issues). |
| Desktop tests (Windows) | `ClinicNode.Tests`: 467 pass, **11 fail** (`GoldenParityTests`, CRLF line endings on Windows — old), 6 skipped. `ClinicNode.Api.Tests`: 132 pass, **1 fail** (`PaperQueueTests.Offline_with_no_reserved_number…`, stale since reserved queue blocks were removed — old). |
| Backend tests | 523 pass, 4 old queue-clash failures (old). |
| Web tests | 13 old consultation-UI failures (old). ESLint and unit tests can't run on the Windows PC (Node 16). |
| Mac build | **No longer a workflow step** (Mac is not a user platform; MacBoy is out of the workflow). Last result: 0 errors on MacBoy (Xcode 27.2) **before** `2283986`. The cloud release still builds Mac with **Xcode 26.0**, and a failure there publishes nothing (D). |
| Known open issues | ~9 server **403s per page load** on some page (not identified); Mac print defaults to US Letter; two offline computers can issue the same queue number (flagged); web can't print the PTR; **no backups** (database or `App_Data/uploads`); no password-reset email; no uptime monitor; slow US host (6–9 s per request seen).<br>**Old web bugs found in J-1 (also on web `main` bd0f449, NOT fixed in this release):**<br>1. **Rx print preview shows the strength after "Sig."**: chart → visit → "Print prescription" (or Reprint → Prescription) opens "Print Preview" with `1. Paracetamol #10 · Sig. 500mg 1 tab every 6 hours…`; the real printed form is right (`Sig. PO 1 tab every 6 hours…`). Code: `Sig. {item.dosage} {item.instruction}` in `doctor/patients/[id]/page.tsx` (since Sep 2026), same pattern in consultation2 View mode (`Sig. {rx.dosage} {rx.instruction}`), `PatientHistoryModal.tsx`, `patient/prescriptions/page.tsx`.<br>2. **"Consultation saved" shows the old fee**: walk-in New + medical certificate (booking fee ₱500) → consult → switch to "Follow-up visit" → fill notes, Rx, certificate, No follow-up → step 8 and the Review say **Charge ₱400** (Follow-up ₱350 + certificate ₱50) → Confirm & Complete → summary says **"Professional fee: Charge ₱500"**. The saved booking and payment are correct (₱400); only the summary line is wrong: it falls back to `booking.totalFee` loaded when the page opened (consultation2 `page.tsx`, Nov 20–21 code).<br>3. **Web chart "New Prescription" on a visit that already has a prescription REPLACES it** (`/doctor/patients/<id>/prescriptions/create?bookingId=…` → `PUT /api/prescription-groups/by-booking`, which keeps one group per visit and replaces its lines; no warning). Old code. So the web can never show "Prescription 1 / 2"; only a desktop's local copy can have two groups. |

---

## G. Key files

**Project02-Desktop** (`ClinicNode/…` unless shown)

| Path | Purpose |
|---|---|
| `HANDOFF.md`, `CLAUDE.md`, `docs/handoff/00-START-HERE.md` | handoff, rules, running state log |
| `ClinicNode.App/Views/Doctor/ConsultationPage.xaml(.cs)`, `.Ui.cs`, `.Gaps.cs`, `.Safety.cs` | consultation (steps, autosave, print; `SectionTitle` = step title bar; `OnOpenChart`, `_backFromChart`) |
| `ClinicNode.App/Views/Doctor/ConsultationPage.LabUploads.cs` | Lab Orders 75/25 + "Uploaded results" + upload |
| `ClinicNode.App/Views/Doctor/Extra/DoctorPatientChartPage.cs` | chart: visits, Results & files, Reprint view, `CanUploadTo`, `PrintLocalAsync` |
| `ClinicNode.App/Views/Doctor/Extra/PatientFileUpload.cs` | picker + multi-file upload to one visit |
| `ClinicNode.App/Views/Staff/StaffUi.cs` (`StaffDialog`), `Views/Staff/ModalClose.cs` | pop-ups: close first, then answer |
| `ClinicNode.App/Views/Doctor/Extra2/DoctorTemplateEditorPage.cs`, `DoctorTemplatesWorkspacePage.cs` | templates (`LeaveAsync`, `_opening`, `DetachSearch`) |
| `ClinicNode.App/Controls/UiTurn.cs`, `BusyButton.cs` | Windows-safe redraw; busy buttons |
| `ClinicNode.Api/Http/ApiClient.cs` | HTTP client (JWT refresh, `DownloadAsync`, `UploadAsync`) |
| `ClinicNode.Api/Services/ApiDoctorExtraAppointments.cs` | `ApiDoctorPatientsService` (chart, file up/download) |
| `ClinicNode.Core/DoctorExtra/DoctorPatientsService.cs` | chart records (`ChartFile.BookingId`) + local implementation |
| `ClinicNode.Core/Printing/ClinicFormsPrintDocumentFactory.cs`, `ClinicFormsHtml.cs` | printed forms (`PrescriptionGroupAsync`) |
| `ClinicNode.Core/Update/UpdateChecker.cs` | OTA: higher version only |
| `ClinicNode.App/MauiProgram.cs`, `ClinicNode.App/Doctor/DoctorExtraModule.cs` | DI (`AddOnlineFirst`) |
| `.github/workflows/release-desktop.yml` | tag → Windows then Mac → feed (all-or-nothing) |

**Project02-be**

| Path | Purpose |
|---|---|
| `src/ClinicApp.Api/Controllers/PatientFilesController.cs` | upload / list / download lab results and documents (`bookingId` required, patient access check) |
| `src/ClinicApp.Infrastructure/Files/LocalFileStorageService.cs`, `FileSignature.cs` | disk storage, safe names, type/signature check, 10 MB |
| `src/ClinicApp.Api/Program.cs` (`FileStorage:RootPath`, default `App_Data/uploads`) | storage location |
| `src/ClinicApp.Api/Controllers/SettingsController.cs`, `QueueController.cs`, `Billing/AutoPaidOnComplete.cs` | settings; auto-paid on Completed |
| `src/ClinicApp.Domain/Entities/Admin.cs` | `ClinicSetting` |
| `src/ClinicApp.Infrastructure/Migrations/`, `DevDataSeeder.cs`, `QueueSequencer.cs` | migrations, fake dev accounts, queue numbers |
| `.github/workflows/deploy-backend.yml`, `deploy/publish.sh`, `deploy/migrate-db.sh` | push `main` → migrate → FTP (never deletes uploads) |

**Project02-fe**

| Path | Purpose |
|---|---|
| `src/app/doctor/consultation2/[bookingId]/page.tsx` | web consultation (Lab Orders upload + 75/25, "Patient chart" link, `requiredSectionsFor`) |
| `src/app/doctor/patients/[id]/page.tsx` | web chart (Results & files per visit, Reprint view, Visit column + Open) |
| `src/components/doctor/VisitUploadModal.tsx`, `VisitFilesPanel.tsx` | upload pop-up (1–10 files, can't close while sending); uploads panel (reloads on tab return) |
| `src/lib/visit-upload.ts` (+ `.test.mjs`) | upload rules |
| `src/lib/consult-print.ts` | print by booking (`printMedicalCertificateForBooking`, `loadBookingReprintAvailability`) |
| `src/lib/data/patientFiles.ts` | upload / list / open patient files |
| `src/lib/print-forms-html.ts` | **source of truth** for printed forms |
| `src/app/admin/settings/page.tsx`, `src/lib/data/admin.ts` | Admin settings |

---

## H. Config and gotchas

**Environment variable names (never values)**
- **Backend:** `ConnectionStrings__DefaultConnection`, `Database__Provider`, `Jwt__Secret` / `Jwt__Issuer` / `Jwt__Audience`, `Email__*`, `ClientBaseUrl`, `Cors__AllowedOrigins`, `FileStorage__RootPath` / `FileStorage__PublicPathPrefix` / `FileStorage__MaxFileSizeBytes`, `RateLimiting__*`, `Registration__PatientSelfSignUp`, `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`.
  - CI secrets: `DB_PASS`, `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
  - CI vars: `BACKEND_URL`, `FTP_PORT`, `FTP_REMOTE_DIR`.
- **Web:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_TIME`, `NEXT_PUBLIC_SHOW_VERSION`, `NEXT_PUBLIC_LOCAL_NODE`, `NEXT_PUBLIC_ENABLE_SW_DEV`, `CLINIC_LOCAL_NODE`, `JWT_SECRET`, `DOTNET_JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `TZ`.
- **Desktop:** see D. CI secrets: `BE_READ_TOKEN`, `RELEASES_TOKEN`, `UPDATE_SIGNING_KEY`.
- **Ports:** the local QA backend uses `http://localhost:5055`.

**Gotchas that cost time**
1. **WinUI crashes:**
   - A control with two parents: detach before `Clear`/re-add.
   - Redrawing inside the handler of a control the redraw removes: use `UiTurn.Next(...)`.
   - Hard crashes (0xC000027B) skip `errors.log`. Diagnose with a *temporary* `AppDomain.FirstChanceException` logger in `Platforms/Windows/App.xaml.cs`, and **never commit it**.
2. **A pop-up that answers before it closes** makes Windows show pages as full-window overlays. Always close first, then answer.
3. **On Windows, `OnAppearing` fires again when any modal closes.** Don't redraw unconditionally there (it wipes typed text); see `_backFromChart`.
4. **Line endings:** sed/perl on Windows writes LF. Git normalizes on commit, which is fine. But `git apply` into the QA worktree **failed silently**: copy the files and **touch their timestamps**, or the build reuses stale DLLs. Some web files are CRLF, so use exact-text editing.
5. **Don't `dotnet test ClinicNode.slnx` on Windows.**
6. **The doctor uses the dev laptop during clinic hours.** No on-screen testing then. Never stop her app.
7. **`latest.json` is cached** for about 5 min.
8. **PowerShell 5.1:** no `&&`. Write commit messages to a file and use `git commit -F <file>` (UTF-8 **without BOM**).
9. **Deploy gap:** the database migrates before the code is uploaded, so migrations must be additive.
10. **Vercel:** any pushed branch gets a Preview build. A Preview **talks to the live API**: test with a TEST patient only.
11. **Node 16 on the Windows PC:** the web can only be type-checked (`npx tsc --noEmit -p .`). Unit tests: compile `visit-upload.ts` with `npx tsc … --types "" --skipLibCheck --noResolve`, then `node --test`.

---

## I. Decisions and rules to keep (ask the owner before changing any)

| # | Rule / decision | Why |
|---|---|---|
| 1 | Never tag, deploy, merge into `main` or push `main` without the owner saying "ship" / "release" / "push". | live clinic |
| 2 | **Ship only 11:00 PM–12:00 midnight Manila. NEVER 8:00 AM–9:00 PM.** "Ship" = pushing `main` in any repo, a `v*` tag, merging into `main`, or running a deploy/release workflow. **If the owner says "ship" outside the window: refuse, say the current Manila time and when the window opens, and hold firm even if he insists.** Say the Manila time before every ship step. Pushing a non-main branch by exact name is fine any time. | deploys restart the server; Windows updates silently mid-consult |
| 3 | Push exact refs only (`git push origin <branch>`, or `git push origin main v0.2.46` at ship time). Never `--all` / `--tags`. | avoid accidental deploys |
| 4 | Batch work into one release. | each release = 20–25 min + a silent update |
| 5 | **The owner types all passwords.** Never ask for, type, repeat, log or commit one. No real patient data in logs, commits or tests. | security, privacy law |
| 6 | Say where a UI control goes in one line, then build exactly that. | owner preference |
| 7 | Wrap new code in `//JJQR - AI (date) - why … //JJQR - END` (TSX: `{/* //JJQR … */}` … `{/* //JJQR - END */}`). | convention |
| 8 | Windows: never reuse a control with an old parent; redraw on the next UI turn; pop-ups close first, then answer. | WinUI crashes |
| 9 | Plain English, short bullets, proof (log, screenshot, test) before "done". | owner is not a programmer |
| 10 | Staff AND doctor both add walk-ins (doctor: menu "Walk-In"); the server rules were **not** widened. | owner |
| 11 | Cancel booking: reason radios; "Others" enables a text box (5+ characters). | owner |
| 12 | Auto-paid on complete: Admin switch, off by default; marks Cash, exact amount, no OR. | owner |
| 13 | Consultation required parts: Admin-configurable; default Clinical notes + fee; vitals not required; fee always required; a follow-up with no date = no follow-up. | doctor |
| 14 | **Every uploaded file belongs to exactly one consultation (visit).** Upload only inside that visit (chart) or in that consultation's Lab Orders step, never "to the latest visit". Not on Cancelled / NoShow / Expired / Rescheduled visits. | owner: "Nov 25 result stays in Nov 25" |
| 15 | Lab Orders: **"Upload results" in the step title bar (right); 75% tests / 25% uploads**; 1–10 files, PDF/JPG/PNG, 10 MB each. Same on desktop and web. | owner |
| 16 | **Reprint = a button in the chart's left panel** (desktop: under "Print patient card"), not a tab. Each prescription is printed on its own. | owner |
| 17 | "Patient chart" from the consult opens **without** the booking (web: new tab). | stops the consult's autosave overwriting chart edits |
| 18 | **Desktop and web stay feature-equal** for these doctor features. | owner: "whatever we did for desktop, make it in web" |
| 19 | Printed forms: web `print-forms-html.ts` is the source of truth; the desktop matches byte for byte. | golden tests |
| 20 | Migrations additive only; a DROP needs the owner + a backup + the manual tick. | live data |
| 21 | Never touch a database directly for QA; use the app or the local fake server. Repo test scripts must be opt-in and localhost-only. | live data |
| 22 | The QA copy (`ph.clinicnode.qa`) and its manifest change are **never committed**. | it would change the real app's identity |
| 23 | Don't merge or push backend `main` for this release (nothing changed). | avoids a pointless server restart |
| 24 | **Users: Windows (Clinic Node desktop app) + iPad (the WEBSITE in Safari). No iPad app. Mac is not a user platform.** Every web change must work in iPad Safari (portrait and landscape, touch, no hover). All dev/QA on the Windows laptop (`D:\sidequest\…`); no Mac build step. | owner, 25 Nov 2026 |

---

## J. Next steps (priority order)

1. **Check the web change (Vercel Preview).**
   - Vercel already builds a Preview for the pushed web handoff branch: Vercel dashboard → Project02-fe → Deployments → branch `handoff/claude-to-grok-2026-11-25`.
   - **The Preview talks to the LIVE API, so use a TEST patient only, never a real patient.**
   - Sign in as the doctor; the owner types the password.
   - Check:
     - a consultation → step 4 Lab Orders: Upload results is top right; 75/25; upload 1 file, then 3; the pop-up can't close while sending; files appear on the right;
     - "Patient chart" opens in a new tab; uploading there and coming back refreshes the right panel;
     - the chart: a visit's Results & files + Upload; no Upload on cancelled visits; the Lab Results / Documents Visit column + Open; Reprint lists each prescription, lab request and certificate;
     - a narrow window: the tests show before the uploads.
   - If no test patient exists, ask the owner how he wants to create one (Admin → Patients → Add). Don't use real data.
2. **iPad check on the website** (once the web change is reachable from the iPad: the Vercel Preview, or production after the ship).
   - **The Preview uses the LIVE API** (and so does production): **TEST patient only**, never a real patient. Uploads can't be deleted (K), so keep test uploads few and clearly named.
   - Safari on a **real iPad**; sign in as the doctor (the owner types the password).
   - Check:
     - consultation → step 4 Lab Orders → Upload results, in **portrait and landscape** (layout, buttons reachable, pop-up usable);
     - upload a **photo taken with the iPad camera** (iPad photos are HEIC): it **must arrive as JPG** (the server accepts PDF/JPG/PNG only);
     - **Open** a file;
     - **Reprint**, and print via **AirPrint**.
3. **Desktop click-through in the QA copy** (after clinic hours). Start the local backend + QA app (A).
   - Check:
     - consult → Lab Orders upload; Cancel is blocked while sending;
     - chart → visit Details → Upload, and the file shows only there;
     - Reprint → patient card, Prescription 1/2, lab request, certificate (fake "Ana Santos", 25 Nov);
     - Cancel booking, Record payment, Reschedule, Register patient, Prescription edit/template, an Admin dialog: each closes cleanly, with no full-window overlay;
     - Templates: delete then edit; double-tap.
   - Fix anything on the handoff branches (desktop or web), commit, and push **only** the handoff branch by exact name.
4. **Ship in the window** with checklist E: desktop v0.2.46 + web; backend untouched.
5. **Smoke test after the update** (after hours); update START-HERE section 2.
6. **NEXT JOB after the release: prescription-overwrite warning.** Web chart "New Prescription" on a visit that already has a prescription silently REPLACES it (F, old bug 3). Add a clear warning (or ask the owner how it should behave) before anything else.
7. **Make the Windows test run green:**
   - `GoldenParityTests`: normalize line endings (e.g. `.gitattributes` `*.json text eol=lf` for the golden files, or compare ignoring `\r`).
   - Update or delete the stale `PaperQueueTests` case.
8. **Backups** for the database **and `App_Data/uploads`** on the host. Plan it with the owner; he runs the tools (`accounts-tools`).
9. Find the page causing ~9 server 403s per load; decide `SyncResultPage`; optionally have the server enforce the app-only upload rules (dead visits, 10 files); Mac A5 default; password-reset email; uptime monitor; faster hosting.

---

## K. Questions already asked and answered (don't re-ask)

| Question | Answer |
|---|---|
| Is `git push origin main v0.2.46` allowed, given "exact names only"? | **Yes.** It names exact refs. Only `--all` / `--tags` are banned. Pushing `main` then the tag separately is also fine. |
| "4 commits ahead": against what? | Desktop **local `main` (`5a454cf`) is 4 commits ahead of GitHub `main` (`a0822d1`)**. The handoff branch is local `main` + more (about 14 commits ahead of GitHub `main`). Check both before the fast-forward merge (E-2). |
| START-HERE section 2 said uploads go to "the latest visit" / "uncommitted". | **Fixed** in commit `01947a4`: section 2 now matches this file. Uploads belong to one visit. |
| What if the Mac release job fails? | **Nothing is published.** The Mac job runs after Windows and force-pushes the feed only as its last step. If Windows fails, the Mac job never runs. No safe Mac compile check exists without publishing; don't run the workflow by hand. |
| Did 25 Nov need backend changes? | **No.** The upload endpoints exist since 9 Sep 2026 (`0706866`). `bookingId` is required per file (that's what makes "one visit" work), with list-by-booking, type/size/signature checks, patient access checks and disk storage. The upload test ran against backend code identical to live `main`. |
| Where are uploaded files stored, and how are names handled? | On the backend host's disk, `App_Data/uploads/<patientId>/<bookingId>/<unixMillis>-<name>`. The name is reduced to `[A-Za-z0-9._-]` (others become `_`), with a timestamp prefix (never overwrites). The original name and title are in the database. Deploys never delete the folder. No backups yet. |
| Does the web need the template / pop-up fixes? | **No.** Those were Windows desktop crash fixes. Only the doctor features were copied to the web. |
| Can the web run on the Windows PC? | No (Node 16). Use the Vercel Preview (test patient) or a machine with Node 20+. |
| Can rollback install an older desktop version? | **No.** The updater only installs higher versions. Roll back by shipping v0.2.47 with the reverted code. |
| Was J-1 (web) done on the live Preview? | **No.** The owner said no: uploads can't be deleted (`PatientFilesController` has GET/POST only) and the live disk has no backup. J-1 ran on a local fake-data stack (F). |
| Sig-shows-strength and ₱500-vs-₱400: new? | **Old.** Both happen on web `main` bd0f449 too, and the handoff commits don't touch that code. Listed in F; not fixed in this release. |
| Several files, empty title? / Upload times in UTC? | Fixed: desktop `2283986`, web `4d033ac` (title "Lab results <date>" / "Documents <date>"); web shows Manila time. Desktop already showed local time. |
| Mac build? | **No longer a workflow step**: Mac is not a user platform and MacBoy is out of the workflow (25 Nov). Last result 0 errors before `2283986`. The release still builds Mac; a failure there blocks the Windows update (D). |
| Who uses what? | Windows desktop app + the website in Safari on an iPad. No iPad app, no Mac users (A, I-24). |

---

## Starter prompt for Grok (the owner pastes this)

> You are taking over a LIVE clinic system from Claude. Read before doing anything:
> 1. In each repo — Project02-Desktop, Project02-be, Project02-fe (github.com/jessiejek) — check out `handoff/claude-to-grok-2026-11-25` and read `HANDOFF.md` fully (same file in each), then `Project02-Desktop/docs/handoff/00-START-HERE.md` and `Project02-Desktop/CLAUDE.md`.
> 2. Section K answers the questions already asked; don't re-ask them. If something truly isn't covered, write "not found" and ask; don't guess.
> 3. Don't redo finished work (B, E, F). Treat every rule in section I as fixed; ask the owner before changing any.
> 4. Ship only when the owner says "ship" AND it is 11:00 PM–12:00 midnight Manila. NEVER 8:00 AM–9:00 PM. If he says "ship" at the wrong time, refuse, tell him the Manila time and when the window opens, and hold firm. Say the Manila time before every ship step.
> 5. Push exact refs only; never `--all` or `--tags`. Never touch backend `main` for this release.
> 6. The owner types all passwords. Never ask for, print, store or commit passwords, keys, tokens, connection strings or real patient data. A Vercel Preview uses the live API: test patients only.
> 7. Don't test on screen while the doctor uses the Windows laptop; never stop her app; use the QA copy + local fake-data backend (section A).
> 8. Plain English, short bullets, proof before "done". Say exactly where a UI control goes before building it.
> Reply first with 5 short bullets: production state, what's waiting to ship, the ship rules, what is not verified yet, and next step #1. Then wait for the owner's OK and start with section J step 1.
