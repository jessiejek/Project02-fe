# FINISH CHECKLIST (memory file — re-read before each item; tick with commit hash)

Branch: finish/all (both repos). Local only, never push. Stage explicit paths only.
Tests: own servers FE :3100 / BE :5155 (see e2e/README.md). Full suite ONCE at the end.

## Phase 0
- [x] P0-1: Merge test/e2e-full-coverage into main locally; branch finish/all in BOTH repos (FE main merge 1e978ea; BE had no e2e branch; finish/all created in both)
- [x] P0-2: Back up local ClinicAppDb to ~/Documents/Allyn/db-backups/ (backup ~/Documents/Allyn/db-backups/ClinicAppDb-pre-finish-20261120-094229.bak)

## Phase 1 — security and money
- [x] B-32: Deactivated account can't log in; its tokens rejected (BE b63b4c1+80565a4+f761069, FE d4665b6; xUnit + e2e pass)
- [x] B-38: Refund bigger than amount paid rejected (BE 5b1bbda, FE 029a576; xUnit + e2e pass)
- [x] B-02: Payment confirm validates amount (server) (BE 5b1bbda, FE 029a576; xUnit + e2e pass)
- [x] B-03: Payment UI NaN/0/negative shows error (FE 029a576; unit + e2e pass)
- [x] B-06: Booking respects doctor's blocked dates (server + UI) (BE 9691d06+5930fb3+26d7e0b, FE d4665b6; xUnit + e2e pass)
- [x] B-29: Booking rejected on a day the clinic is closed (BE 9691d06, FE d4665b6; xUnit + e2e pass)

## Phase 2 — workflow
- [x] B-40: Amend after "No follow-up" not stuck; disabled Save/Review/Complete shows which section is missing (FE 94678a6; e2e verified at F-1)
- [x] B-05: Same patient can't book same date twice (BE 9691d06, FE d4665b6; xUnit + e2e pass)
- [x] B-04: Reviews only for COMPLETED visit (BE 2d2a948, FE a19081d; xUnit pass, e2e at F-1)
- [x] B-37: Publish new consent version makes patients accept again (BE 4f48521+; FE 9dbf69c; xUnit pass, e2e at F-1)

## Phase 3 — validation and display
- [x] B-01: Server validation (patients, announcements, settings, staff, vitals, vaccinations, lab orders) (BE fd57c1b + Check/Rules helpers; FE 05e8deb; xUnit 18 pass, e2e at F-1)
- [x] B-36: Clinic name/address can't be blank (BE 4f48521, FE 9dbf69c)
- [x] B-31: No negative fee (doctor edit page) (BE c525c90, FE cf78e91)
- [x] B-34: No negative fee (Fees tab) (BE 4f48521, FE 9dbf69c)
- [x] B-33: No future date of birth (BE fd57c1b, FE 05e8deb+cf78e91)
- [x] B-35: Same min cancel-reason length admin/staff (5) (FE cf78e91 (UI only; server cancel has no min length so internal cleanup helpers keep working))
- [x] B-30: Announcements shown to staff and patients (FE 179d4e4; e2e pass in batch1)
- [x] B-39: /patient/doctors fits phone/iPad (FE ed53ac5 (real cause: huge review comment on the single doctor's profile after redirect); verify at F-1)
- [x] B-41: Doctor dashboard "+N more" (FE 179d4e4; e2e pass in batch1)
- [x] B-42: Staff dashboard no 500 cap; don't count cancelled (BE 3cf5494+, FE ed53ac5; re-verify at F-1)

## Phase 4 — privacy (RA 10173)
- [x] PV-1: docs/privacy/AUDIT.md (OK/GAP with file:line) (docs/privacy/AUDIT.md 1422457+)
- [x] PV-2: Role AND ownership checks on every endpoint (BE 01060a4 + AUDIT.md endpoint review; open decision: doctors can open any patient)
- [x] PV-3: Password min 12 + common-password block + lockout after failed logins (BE fe999a7 lockout 5 fails/15 min + common-password block + 12 min; FE 691a5d5; xUnit 15 pass)
- [~] PV-4: EXCLUDED by Jessie (Nov 20)
- [x] PV-5: Audit log of record views, logins, failed logins; admin "who looked at this patient" (BE 84109b5 Access/Auth rows + GET /api/audit-logs/patient/{id}/access; FE 691a5d5 'Access log' tab; xUnit 3 pass)
- [x] PV-6: HTTPS only in production; secure httpOnly cookies (BE fd389cf HSTS; FE cookies already httpOnly/secure; GAP: web-app HSTS header needs next.config.ts (yours))
- [x] PV-7: Uploaded files never public; auth + type/size checks (BE a533f03 server-side name+magic-byte check; FE e2e fixtures updated)
- [x] PV-8: Secrets out of code/config into env vars (BE fd389cf prod refuses placeholder JWT secret; GAP: dev creds committed in appsettings.Development.json (not printed))
- [x] PV-9: No patient names/health details in URLs, errors, logs, console (BE 1f7bad5 change log names fields only; GAP: search ?q= in URL (host logs))
- [x] PV-10: PWA never stores patient data; clear on logout (verified by reading your PWA files (NetworkOnly + Clear-Site-Data + clearClientCaches); they are still UNCOMMITTED)
- [x] PV-11: Public privacy notice page (English + Filipino) (FE d8b37fe: /api/public/privacy-notice (public; EN+FIL) + in-app /privacy; e2e pass)
- [x] PV-12: Consent screen (nothing pre-ticked, decline = accept ease, versioned+dated, withdraw) (BE dc53c75 + FE d8b37fe; equal-weight Agree/Decline, versioned+dated, withdraw on Profile>Privacy; xUnit+e2e pass)
- [x] PV-13: Patient downloads own data (BE dc53c75 export + FE d8b37fe 'Download my data'; xUnit+e2e pass)
- [x] PV-14: Patient requests correction/deletion (logged, scheduled) (BE dc53c75 data-requests (7-yr RetainUntil) + FE d8b37fe patient form + admin queue; xUnit+e2e pass)
- [x] PV-15: docs/privacy/PRIVACY-NOTICE.md (DRAFT) (docs/privacy/PRIVACY-NOTICE.md DRAFT 1422457)
- [x] PV-16: docs/privacy/HOW-DATA-IS-HANDLED.md (DRAFT) (docs/privacy/HOW-DATA-IS-HANDLED.md DRAFT 1422457)

## Phase 5 — final
- [ ] F-1: Full suite once (backend + Playwright --workers=4); fix test bugs
- [ ] F-2: Build both (dotnet build, next build); lint 0 errors
- [ ] F-3: docs/FINISH-REPORT.md written and returned

## Assumptions

## Needs Jessie

## Log
- Jessie's uncommitted-file checksums before start: /tmp/finish-jessie-files-before.txt (also copy in ~/Documents/Allyn/db-backups/finish-jessie-files-before.txt)
