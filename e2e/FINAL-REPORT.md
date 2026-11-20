# E2E final report — batch 2 (Nov 20, 2026, Asia/Manila)

Branch `test/e2e-full-coverage` (local only, nothing pushed). Isolated stack: FE `next start :3100` (main 1233a0b) + BE `:5155` (main f1d62d8), same local Docker SQL Server dev DB as the dev stack. Jessie's `:3000` / `:5055` were never touched.

## TESTS (472 tests incl. 5 setup/sweep steps)

| Pass | Fail | Expected-fail (`test.fail`, known app bug) | Skipped | Runtime |
|---|---|---|---|---|
| **408** | **0** | **63** (41 distinct BUG-01…BUG-41, each linked in the test title) | **1** (BUG-42 guard, see below) | **12.2 min** (full run #1, 733 s, 1 worker) |

How that tally was reached (honest breakdown):
- Full run #1 (detached, all specs): 408 passed, 63 expected-fail, **1 failed** — `s3-staff-c` dashboard tile test (see BUG-42). Fixed afterwards.
- Full run #2: the Mac went to sleep mid-run (34.8 min wall-clock); 466 ok, 6 failed — 5 were 60 s timeouts / one stale read caused by the sleep, all 5 passed on rerun (`s3-doctor-a`, `s3-doctor-b`, `s3-patient-a`, `s3-staff-c`: 82 passed); the 6th was the same dashboard-tile test.
- After the final test fixes only the affected spec (`s3-staff-c`) was re-run: 23 passed, 1 skipped, 0 failed. No third full run (one test file changed).
- Expected-fail: Playwright's list reporter prints ✘ for these too; the JSON `status` is `expected`.

## NEW APP BUGS FOUND (numbering continues after BUG-39)

| # | Role | Page | Steps | Expected | Actual | Severity |
|---|---|---|---|---|---|---|
| BUG-40 | Doctor | `/doctor/consultation2/[id]` — Amend a completed consultation | 1. Complete a consultation choosing **No follow-up for this visit**. 2. Reopen it → **Edit Consultation** → Amend. 3. Change any section. | The amended screen restores "no follow-up" and **Save amendment** / section Review buttons are enabled. | The Follow-up step comes back unsatisfied (page.tsx ~1290-1298 never restores mode `none`), so **Save amendment** and every Review button stay disabled until the doctor ticks "No follow-up" again. Nothing tells the doctor why. | Medium |
| BUG-41 | Doctor | `/doctor/dashboard` — Needs attention | 1. Have 6+ completed visits that are unpaid. 2. Open the dashboard. | All of them listed, or a "+N more / view all" link. | List is cut to the first 5 (`unpaidCompleted.slice(0, 5)`, page.tsx ~406) with no indicator; the other unpaid visits are invisible. | Low |
| BUG-42 | Staff | `/staff/dashboard` — tiles and Arrivals | 1. Have more than 500 bookings on today's list (cancelled/expired rows count too). 2. Check in a new walk-in. 3. Open the dashboard. | Tiles/Arrivals include the new walk-in; "Patients on today's list" shows the real count. | Only the first 500 rows (`queryStaffBookings` uses `pageSize: 500`, ordered by slot time) are loaded: screenshot shows **500 patients, 0 booked or checked in, empty Arrivals** while the queue API holds 556. Silent truncation, and "Patients on today's list" counts cancelled rows although the Queue page does not. Unrealistic for a real clinic day, but real for the shared test DB (~130 rows/day per full run). | Low |

Tests: BUG-40 and BUG-41 have `test.fail` tests. BUG-42 has no always-on test (it only appears at >=500 rows): `s3-staff-c` "tiles count a new walk-in" self-skips with the BUG-42 reason when today has >=450 queue rows (it is skipped today, it runs on a fresh day).

## 404 / Complete-disabled / Needs-attention: APP or TEST

1. **"Templates API 404" → TEST bug / by design (not a missing endpoint).** The failing request was `GET /api/consultations/by-booking/{bookingId}`, called by `consultation2/[bookingId]/page.tsx` on load to look for an existing consultation (BE `ConsultationsController.cs:85`; the endpoint exists on main). It returns 404 when the visit has **no consultation yet**, which is the normal state of a new visit; the page treats it as "start blank". It is not a templates endpoint. The guard now allows only `404 GET /api/consultations/by-booking/…` (documented in `e2e/support/fixtures.ts`), nothing broader. (Earlier "stale selector"/404-page failures were CORS: BE :5155 did not allow origin :3100; fixed by env override on my test BE only.)
2. **Complete disabled with "1 required section left" → TEST bug for the Complete flow; the doctor CAN tell.** Required sections are [Clinical notes, Vital signs, Diagnosis, Prescription, Follow-up] (`REQUIRED_SECTIONS`, page.tsx:176). The missing one was **Follow-up**: choosing "No medicines this visit" satisfies Prescription, but "No follow-up for this visit" needs its own checkbox (page.tsx ~2932, satisfaction ~1403). The screen names the missing step (banner ~3641 and the step-bar), and the test never ticked it. Fixed in `e2e/support/consultation-flow.ts` + `s7`. **However the same mechanism shows a real app bug in Amend mode where the doctor is NOT told why → BUG-40.**
3. **Doctor dashboard "Needs attention" failure → TEST bug (data) + app limitation BUG-41.** 56 leftover unpaid E2E visits from earlier runs filled the list, and the list shows only 5, so the new visit never appeared. Fix: a setup step that settles/cancels leftover E2E-named rows (`global.setup.ts`, `[e2e sweep] settled 55 … cancelled 98`) so the assertion is deterministic; the "only 5, no indicator" behaviour is logged as BUG-41 with a `test.fail`.

## Test-bug fixes in this batch (summary)
- 23 old consultation specs moved to the redesigned screen (`e2e/support/consultation-flow.ts` rewritten; batch/minimal/product-decisions/matrix/full-visit/uiux/s7/doctor-scope-pages updated, intent kept).
- Rate limit **left intact in the app**. Root cause was login 429 after Playwright worker restarts (in-memory token cache lost). Fix: JWT tokens cached on disk (`e2e/.auth/api-token-<role>.json`, refreshed <120 s before expiry) plus a 429 retry. Note: per-spec accounts would not help — the limiter is per client IP (120/min in Development), not per account.
- doctor-performance Retry test: its deliberate 500 is allowed only inside that test (`guard.allow("500 GET /api/doctor/performance")`).
- full-visit: date-picker label, licence numbers set through admin PUT and restored (dev doctor has none), payments flow.
- s3-staff-c dashboard: banner test now creates its own unpaid visit; tile test tolerant of shared-DB changes and capped/skipped per BUG-42.

## COVERAGE (details: `e2e/COVERAGE-SUMMARY.md`)

| | Items | COVERED | PARTLY | NOT |
|---|---|---|---|---|
| Pages/routes (incl. redirects) | 58 | 48 | 9 | 1 |
| Forms | 67 | 50 | 9 | 8 |

**Pages: 48/58 fully covered (57/58 at least partly). Forms: 50/67 fully covered (59/67 at least partly).** Plus §4 journeys J1–J6, §5 security (47), §6 screen sizes (28), smoke (37).

NOT covered:
- Route: `/doctor/consultation/[bookingId]/vitals` (legacy vitals page).
- Forms: patient Doctors browse filters (Specialty / Sort by); staff "create account" modal on `/staff/patients`; consultation vitals "Add measurement" (fundal height/FHR) + out-of-range warning; doctor Templates → Favorites, Diagnoses (ICD-10), Certificates; admin booking "reject payment proof"; admin Settings → Branding logo/favicon upload (preview only).

PARTLY (named gaps): `/staff/queue` (cancel-after-paid), `/staff/bookings/[id]` (staff Confirm, OR number/notes), `/staff/patients`, `/doctor/patients/[id]` (Rx copy/print/delete), `/doctor/consultation2` (ICD search/make primary, Favorites, Refill last visit, weight-based calc, ANC presets, NIP "give today", MC templates/print, amendment history), `/doctor/templates`, `/admin/bookings/[id]`, `/admin/doctors/new` (successful invite), `/admin/settings` (logo/favicon), staff doctor-status bulk buttons.

## Commits on `test/e2e-full-coverage` after dd385bc (nothing pushed)
- `a0f6e56` consultation completion test + by-booking 404 guard allow
- `bf5c322` old consultation specs → redesigned screen; perf Retry 500 scoped; disk token cache
- `b4efb8d` full-visit/amend specs; BUG-40, BUG-41 tests; setup sweep
- `e542f88` COVERAGE-SUMMARY.md
- `584ca7a` staff dashboard tile test tolerant of concurrent changes
- `69362b2` staff dashboard banner test owns data; BUG-42 skip guard
- (this report is committed right after, see `git log`)

## Assumptions / notes
- App code untouched in this batch (no data-testid commits were needed).
- The setup sweep only cancels/settles rows whose patient name starts with `E2E`; it cancelled ~98 open E2E queue rows and settled 55 unpaid E2E visits on the shared dev DB. Cancelled/completed E2E bookings remain in the DB (no delete API), so today's list grows ~130 rows per full run; it resets on the next calendar day.
- `.tmp-screens/` (screenshots written by `consultation-regression-matrix.spec.ts`) was removed; it is generated output.
- Jessie's modified/untracked files (env.example, next.config.ts, package*.json, tsconfig.json, layout.tsx, logout route, Sidebar, sidebar-design test, proxy.ts, public/, manifest/serwist/sw/~offline, components/pwa, lib/pwa, e2e/COVERAGE-PLAN.md) are untouched and uncommitted.
