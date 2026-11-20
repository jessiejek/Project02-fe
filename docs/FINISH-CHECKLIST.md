# FINISH CHECKLIST (memory file — re-read before each item; tick with commit hash)

Branch: finish/all (both repos). Local only, never push. Stage explicit paths only.
Tests: own servers FE :3100 / BE :5155 (see e2e/README.md). Full suite ONCE at the end.

## Phase 0
- [x] P0-1: Merge test/e2e-full-coverage into main locally; branch finish/all in BOTH repos (FE main merge 1e978ea; BE had no e2e branch; finish/all created in both)
- [x] P0-2: Back up local ClinicAppDb to ~/Documents/Allyn/db-backups/ (backup ~/Documents/Allyn/db-backups/ClinicAppDb-pre-finish-20261120-094229.bak)

## Phase 1 — security and money
- [ ] B-32: Deactivated account can't log in; its tokens rejected
- [ ] B-38: Refund bigger than amount paid rejected
- [ ] B-02: Payment confirm validates amount (server)
- [ ] B-03: Payment UI NaN/0/negative shows error
- [ ] B-06: Booking respects doctor's blocked dates (server + UI)
- [ ] B-29: Booking rejected on a day the clinic is closed

## Phase 2 — workflow
- [ ] B-40: Amend after "No follow-up" not stuck; disabled Save/Review/Complete shows which section is missing
- [ ] B-05: Same patient can't book same date twice
- [ ] B-04: Reviews only for COMPLETED visit
- [ ] B-37: Publish new consent version makes patients accept again

## Phase 3 — validation and display
- [ ] B-01: Server validation (patients, announcements, settings, staff, vitals, vaccinations, lab orders)
- [ ] B-36: Clinic name/address can't be blank
- [ ] B-31: No negative fee (doctor edit page)
- [ ] B-34: No negative fee (Fees tab)
- [ ] B-33: No future date of birth
- [ ] B-35: Same min cancel-reason length admin/staff (5)
- [ ] B-30: Announcements shown to staff and patients
- [ ] B-39: /patient/doctors fits phone/iPad
- [ ] B-41: Doctor dashboard "+N more"
- [ ] B-42: Staff dashboard no 500 cap; don't count cancelled

## Phase 4 — privacy (RA 10173)
- [ ] PV-1: docs/privacy/AUDIT.md (OK/GAP with file:line)
- [ ] PV-2: Role AND ownership checks on every endpoint
- [ ] PV-3: Password min 12 + common-password block + lockout after failed logins
- [ ] PV-4: Auto-logout 30 min idle (staff/doctor/admin)
- [ ] PV-5: Audit log of record views, logins, failed logins; admin "who looked at this patient"
- [ ] PV-6: HTTPS only in production; secure httpOnly cookies
- [ ] PV-7: Uploaded files never public; auth + type/size checks
- [ ] PV-8: Secrets out of code/config into env vars
- [ ] PV-9: No patient names/health details in URLs, errors, logs, console
- [ ] PV-10: PWA never stores patient data; clear on logout
- [ ] PV-11: Public privacy notice page (English + Filipino)
- [ ] PV-12: Consent screen (nothing pre-ticked, decline = accept ease, versioned+dated, withdraw)
- [ ] PV-13: Patient downloads own data
- [ ] PV-14: Patient requests correction/deletion (logged, scheduled)
- [ ] PV-15: docs/privacy/PRIVACY-NOTICE.md (DRAFT)
- [ ] PV-16: docs/privacy/HOW-DATA-IS-HANDLED.md (DRAFT)

## Phase 5 — final
- [ ] F-1: Full suite once (backend + Playwright --workers=4); fix test bugs
- [ ] F-2: Build both (dotnet build, next build); lint 0 errors
- [ ] F-3: docs/FINISH-REPORT.md written and returned

## Assumptions

## Needs Jessie

## Log
- Jessie's uncommitted-file checksums before start: /tmp/finish-jessie-files-before.txt (also copy in ~/Documents/Allyn/db-backups/finish-jessie-files-before.txt)
