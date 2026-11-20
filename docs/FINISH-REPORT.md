# Finish report — Gavino Clinic app (Nov 20, 2026)

Branch `finish/all` in both repos. Local only: nothing was pushed, production was not touched.
BE: `~/Documents/Allyn/Project02-be`. FE: `~/Documents/Allyn/Project02-fe`.

## Result
- Every checklist item is ticked except PV-4, which you excluded (marked `[~]`, no code exists).
- Tests: BE xUnit 345/345 pass. Playwright first parallel pass (`--workers=4`, non-`@global`): 467 tests, 453 passed, 14 failed. All 14 are fixed and re-run green. Serial `@global` pass: 23/23.
- Builds: `dotnet build` 0 errors. `next build` OK. `eslint .` 0 errors, 29 warnings.
- Full checklist with commit hashes: `docs/FINISH-CHECKLIST.md`.

## Bugs fixed (B-xx) — see the checklist for each hash
All B-items in Phases 1–3 are done with xUnit and e2e coverage (security and money, workflow, validation and display). Highlights: server-side validation (B-01), one active booking per patient per day (B-06), reviews only for completed visits (B-04), new consent version forces re-consent (B-37), staff dashboard without the 500 cap (B-42).

### Bug found by the full run
`QueueSequencer.NextAsync` re-read a tracked entity with a stale counter after a collision. Simultaneous check-ins therefore failed every retry and the API returned 500 "Could not allocate a queue number". Fixed with a no-tracking read, 25 attempts and a short random delay (BE a7ef198).

## Privacy (RA 10173)
- PV-1: `docs/privacy/AUDIT.md` (OK/GAP with file:line, plus an endpoint review).
- PV-2: ownership checks on every endpoint. Patients no longer get a doctor's personal email/phone.
- PV-3: password minimum 12, common-password block, lockout after 5 failures for 15 minutes.
- PV-4: excluded by you.
- PV-5: access/auth audit log (one row per person + area per 5 minutes, ids only). Admin "Access log" tab on a patient answers "who looked at this record".
- PV-6: HSTS outside Development. Production refuses to start with a short or placeholder JWT secret.
- PV-7: uploads checked on the server for extension, type and file header. Files stay private.
- PV-8: see Needs Jessie for dev credentials in committed files.
- PV-9: audit change logs list field names only, no names or values. Patient names are no longer in the log.
- PV-10: your PWA files were read and fit the rule (network-only, `Clear-Site-Data` on logout). They are still uncommitted.
- PV-11: public Privacy Notice in English and Filipino at `/api/public/privacy-notice`.
- PV-12: consent screen with an unticked box, equal-weight Agree and Decline buttons, version and date, and withdraw in the profile Privacy tab. Consent history is kept.
- PV-13: patient "Download my data" (JSON, no file URLs, audited).
- PV-14: patient correction/deletion requests. Deletion is scheduled to 7 years after the last booking. Admin queue in Settings → Privacy & consent.
- PV-15 and PV-16: `docs/privacy/PRIVACY-NOTICE.md` and `docs/privacy/HOW-DATA-IS-HANDLED.md` (both DRAFT, including the 72-hour NPC breach notice).

## Assumptions
See `## Assumptions` in `docs/FINISH-CHECKLIST.md`. Main ones: consent "updated" date comes from the settings update time; registering no longer auto-consents; "Diagnoses amended" keeps old → new in the log on purpose; the public notice sits under `/api` because `proxy.ts` is yours; doctors and staff can open any patient.

## Needs Jessie
1. BE commit ed1257b accidentally contains your `appsettings.Development.json` CORS edit (no secrets). Review it before pushing.
2. Commit your PWA files (PV-10 relies on them) and review them.
3. Add HSTS and security headers in `next.config.ts` (snippet in the checklist).
4. Add `/privacy` to `isPublicPath` in `src/proxy.ts` if you want the in-app URL public.
5. Dev SQL login and JWT secret sit in committed files (`appsettings.Development.json`, `docker-compose.yml`, `INTEGRATION_ROADMAP.md`). Move them to env/user-secrets and rotate if reused. I did not print them.
6. Patient search puts `?q=<name>` in the URL. Web-server access logs may hold names. Switch to POST or stop logging query strings.
7. Decide whether doctors should only see their own patients.
8. Fill the DPO placeholders and have a legal adviser review the DRAFT docs.
9. Nothing auto-deletes data after 7 years. An admin must complete deletion requests.
10. `package.json` has no e2e script. Run commands are in `e2e/README.md`.
11. e2e wrong-password tests use `patient@clinic.test` (about 3 attempts per run). Several runs in 15 minutes could lock it.
12. A 4-worker run against :5055 can hit the auth rate limit. My test stack lifted the limit with env vars only.

## How to run the suite
```
npx playwright test -c e2e/playwright.config.ts --workers=4 --grep-invert @global
npx playwright test -c e2e/playwright.config.ts --workers=1 --grep @global
```
Tests ran against an isolated stack (BE :5155, FE :3100) built from the committed `finish/all` HEAD in separate worktrees. Your :3000 and :5055 servers were not touched.

## Housekeeping
- Your uncommitted files are unchanged (checksums match `/tmp/finish-jessie-files-before.txt`).
- No new packages were added.
- No force, amend or rebase was used.
- An empty untracked `.tmp-screens/` folder in the FE repo was left from my screenshots and is safe to delete.
- The e2e worktrees are `Project02-fe-e2e` and `Project02-be-e2e` (can be removed with `git worktree remove`).
