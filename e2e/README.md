# E2E tests (Playwright)

Real end-to-end tests. They drive the **actual frontend** (`:3000`) against the
**actual .NET API** (`:5000`) and SQL Server. Nothing is mocked.

## Prerequisites

1. **SQL Server** (via colima + Rosetta):
   ```bash
   colima start --cpu 4 --memory 6 --vm-type=vz --vz-rosetta
   cd ../Project02-be && docker compose up -d
   ```
2. **Backend**:
   ```bash
   cd ../Project02-be
   ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/ClinicApp.Api --no-launch-profile
   ```
3. **Frontend**:
   ```bash
   npm run dev          # port 3000
   ```
4. Dev accounts exist (seeded by `DevDataSeeder`):
   `{admin,staff,doctor,patient}@clinic.test` / `ClinicDev123!`

## Run

```bash
npm run test:e2e          # headless, all specs
npm run test:e2e:ui       # Playwright UI (pick/step through tests)
npm run test:e2e:headed   # watch it in a real browser
npm run test:e2e:report   # open the last HTML report

# watch the full visit play out, slowed down, in a real browser:
E2E_SLOWMO=450 npm run test:e2e:headed -- full-visit
```

Point at other hosts with `E2E_FE_URL` / `E2E_BE_URL`. `E2E_SLOWMO=<ms>` delays
every action so you can follow along.

## What's covered

| Spec | What it proves |
|---|---|
| `global.setup.ts` | Logs each role in via the UI once; caches auth in `e2e/.auth/*.json`. |
| `auth.spec.ts` | Logged-out → `/login`; each role lands on its own dashboard; cross-portal URLs bounce back. |
| `smoke.spec.ts` | Every nav route, every role, loads with no SSR error page and no uncaught console error. (This is the net that catches things like the patient-portal `doctor-ratings` 403.) |
| `full-visit.spec.ts` | **The flagship.** staff registers a patient → checks them into the queue → calls them; doctor fills **every** clinical field — all 5 SOAP boxes, all 7 default vitals, a primary + secondary diagnosis, a prescription, a lab order, a follow-up — then completes; the test then reads the consultation (and its children) straight from the API and asserts **each value it typed came back**, so a field that renders but never persists fails here. Then staff completes the queue entry → collects Cash payment; doctor prints the prescription → the test captures the print window, asserts its contents, and saves the rendered PDF to `e2e/artifacts/`. |

## Notes

- Runs **sequentially, 1 worker** — shared database.
- `full-visit` creates a guest patient named `E2E <id> Tester`. There's no
  patient-delete endpoint yet, so those rows linger; grep `E2E ` to clear them.
- The app's "PDF" is `window.open()` + `window.print()` (a popup with print CSS,
  no PDF library). The test reads that popup's HTML and also renders it with
  headless Chromium's `page.pdf()` for a real file artifact.
- `e2e/` is excluded from the app's `tsconfig`/eslint and has its own `tsconfig.json`.

## Full-coverage suite (`test/e2e-full-coverage`)

Added on top of the specs above, following `COVERAGE-PLAN.md`:

| Spec | Covers |
|---|---|
| `s0-setup-redirects.spec.ts` | Setup checks and redirects (§0) |
| `s2-suspected-bugs.spec.ts` | B1–B7 suspected bugs, each asserting the *correct* behaviour |
| `s3-public`, `s3-patient-a/b` | Public pages and the whole patient portal, form by form |
| `s3-staff-a/b/c` | Walk-in wizard, queue, booking detail + payments, patients, doctor status, announcements, profile, dashboard |
| `s3-doctor-a/b` | Dashboard, appointments, schedule, profile, patient chart, vitals, Rx pages |
| `s3-admin-a/b` | Doctors, staff team, patients, announcements, bookings (list/week/detail), settings, reports, audit log, dashboard |
| `s4-journeys` | Cross-role journeys 1–6 |
| `s5-security` | Role fences, expired sessions, API role matrix, patient A vs B, template privacy |
| `s6-screens` | iPad portrait (768×1024) and phone (375×812) |

Conventions:
- Every test tags what it creates `E2E-<runId>-…` (`tag()` fixture) and removes it afterwards (`cleanup()` fixture, runs even on failure). No test relies on another test.
- A test that finds an app bug keeps asserting the **correct** behaviour and is marked `test.fail(true, "BUG-nn: …")` inside the test body. It shows as an *expected failure* now and turns red the day the bug is fixed — remove the marker then.
- The `guard` fixture fails an expected-pass test on any 4xx/5xx API response or page error; expected ones are allow-listed per test with `guard.allow(...)`.
- Patients have no delete endpoint, so tagged patients (`E2E-…`) linger in the dev database.

### Running against an isolated stack (does not touch :3000 / :5055)

```bash
# 1. a second API on :5155 from a throwaway worktree of the backend, same local Docker SQL Server
cd ../Project02-be && ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://127.0.0.1:5155 dotnet run --project src/ClinicApp.Api --no-launch-profile
# 2. a production build of the frontend on :3100 pointed at it
cd ../Project02-fe && npm run build && npx next start -p 3100
# 3. run the suite
E2E_FE_URL=http://localhost:3100 E2E_BE_URL=http://127.0.0.1:5155 npx playwright test -c e2e/playwright.config.ts
```

## Running the whole suite in parallel (finish/all)

Most specs make their own data and can run side by side. A few change **clinic-wide state** (settings, the consent version, operating hours, deactivating the demo doctor); they carry `@global` in their title and must run alone.

```bash
# 1) parallel pass — everything except @global
npx playwright test -c e2e/playwright.config.ts --workers=4 --grep-invert @global
# 2) serial pass — only the @global tests
npx playwright test -c e2e/playwright.config.ts --workers=1 --grep @global
```

The config still defaults to one worker, so a plain `npx playwright test` is unchanged. Wrong-password logins lock an account for 15 minutes after 5 failures (PV-3): keep failed-login tests to a throw-away account or ≤ 3 attempts per run on the shared dev users.
