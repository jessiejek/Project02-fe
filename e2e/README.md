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
```

Point at other hosts with `E2E_FE_URL` / `E2E_BE_URL`.

## What's covered

| Spec | What it proves |
|---|---|
| `global.setup.ts` | Logs each role in via the UI once; caches auth in `e2e/.auth/*.json`. |
| `auth.spec.ts` | Logged-out → `/login`; each role lands on its own dashboard; cross-portal URLs bounce back. |
| `smoke.spec.ts` | Every nav route, every role, loads with no SSR error page and no uncaught console error. (This is the net that catches things like the patient-portal `doctor-ratings` 403.) |
| `full-visit.spec.ts` | **The flagship.** staff registers a patient → checks them into the queue → calls them; doctor records CC + vitals + diagnosis + a prescription → completes; staff completes the queue entry → collects Cash payment; doctor prints the prescription → the test captures the print window, asserts its contents, and saves the rendered PDF to `e2e/artifacts/`. |

## Notes

- Runs **sequentially, 1 worker** — shared database.
- `full-visit` creates a guest patient named `E2E <id> Tester`. There's no
  patient-delete endpoint yet, so those rows linger; grep `E2E ` to clear them.
- The app's "PDF" is `window.open()` + `window.print()` (a popup with print CSS,
  no PDF library). The test reads that popup's HTML and also renders it with
  headless Chromium's `page.pdf()` for a real file artifact.
- `e2e/` is excluded from the app's `tsconfig`/eslint and has its own `tsconfig.json`.
