# Doctor portal: 20-rule design pass

## Scope and safety

- Next.js 16.2.10 App Router, React 19.2.4, TypeScript, Tailwind v4; existing semantic Card/Button/StatusPill/Icon primitives and teal primary brand retained.
- All 14 doctor page routes plus the doctor layout/navigation were inspected and updated. Clinical validation, allergies/NKDA safeguards, prescription calculations, completion/amendment rules, and API authorization were not redesigned.
- Work is isolated on `main` in `/Users/jessiejayrubi/Documents/Allyn/Project02-fe-doctor-main`. The original `Project02-fe` checkout remains on `authz-p0-hardening`, with its pre-existing dirty/untracked files preserved. No push.
- Real local Development API on `127.0.0.1:5055`, backed by local Docker SQL only. No direct database queries, remote database access, fixture insertion, or clinical mutations were used for this pass.

## Before → after, all 20 rules

| # | Rule | Concrete finding and result |
|---|---|---|
| 1 | Delete filler badges | Duplicate payment pills competed with clinical identity; the chart's blanket “Read-only” label was misleading. Removed in `appointments/[id]/page.tsx`, `patients/[id]/page.tsx`, and the completed consultation view. Clinical status/allergy/OB warnings are useful and retained. No unsupported trust claims added. |
| 2 | Drop redundant labels | Settings duplicated the entire template manager; zero appointments produced redundant empty panels and useless filter reset actions. `settings/page.tsx` is now a real navigation hub; `appointments/page.tsx` has one useful empty state/history action. Form labels remain persistent. |
| 3 | Unitalicize random words | No random italic headline emphasis found in the doctor routes. Already fine; clinical wording was not restyled for novelty. |
| 4 | Mono only where needed | Keep monospace for patient identifiers and genuine keyboard-shortcut hints only; queue positions, dates and measurements use proportional text with tabular figures. `AppointmentList.tsx`, patient charts and vitals context follow this distinction. |
| 5 | Use a design system | Introduced reusable `DoctorPageHeader.tsx`, isolated doctor form/layout CSS, common appointment model/list/focus components, and named `--container-doctor-*` tokens in `globals.css`. The explicit container namespace avoids Tailwind spacing-lg/xl collisions that can collapse search/copy widths. |
| 6 | Show the actual product | Dashboard's fabricated shift/tomorrow hours removed; real queue is first, reports secondary. History now shows real visit dates rather than undated rows/meaningless midnight slots. Missing payment information remains “Not recorded,” never invented “Unpaid.” See `dashboard/page.tsx`, `appointments/`, and `consultation2/[bookingId]/page.tsx`. |
| 7 | Enlarge the main feature | Today gets a large actionable patient/queue focus when patients exist; the real patient queue dominates the dashboard. Completed consultation expands from a 40rem column to 64rem, with a readable clinical note and structured vital measurements. |
| 8 | Group with spacing | Identity/action groups, summaries, toolbar, filters and list are distinct. Patient directory and appointments paginate at 20 instead of dumping hundreds of rows. Template filters wrap instead of hiding in horizontal rails. |
| 9 | Specific headlines | “Your clinic today,” “Appointment history,” “Clinic availability,” “Consultation templates,” “Record vital signs,” “Consultation record,” “New/Edit prescription,” and “Document/Amend consultation” replace generic headings across the corresponding routes. |
| 10 | Emphasize the CTA | One primary Start/Resume action in `AppointmentFocus.tsx`; row links are secondary. Empty today state gives a useful history action. Profile/schedule/vitals/prescription save actions are explicit and show pending state. |
| 11 | One accent colour | Teal primary consistently drives doctor nav, active filters, visit-type selection and CTAs. Red/amber/green retain semantic clinical/status meanings, not decorative brand accents. |
| 12 | Consistent icons | Reused the bundled `Icon` vocabulary with stable dimensions; removed the text-arrow back icon in appointment details and decorative profile avatar controls. Shared doctor nav uses one icon size and active nested-route state. |
| 13 | Remove embellishments | Removed inert Change Photo/decorative profile avatar, misleading read-only badge, fabricated schedule decoration and redundant payment badges. No new gradients, abstract illustrations, fake ratings, or unnecessary hover motion. |
| 14 | Inner radius = outer − padding | Today's/History segmented control derives the inner radius with `calc(var(--radius-xl) - var(--spacing-xs))`; larger surfaces reuse existing radius/border/spacing tokens rather than arbitrary nested pills. |
| 15 | Text contrast | Doctor navigation uses dark text on a light surface; field placeholders use the readable semantic foreground, not faint decorative grey. Clinical note text is on-surface; allergy warning/danger foregrounds use tested semantic contrast tokens. |
| 16 | Proper headline wrapping | Reusable header plus doctor-scoped heading balancing. Patient names wrap; full allergy names/reactions and guardian names no longer get arbitrarily truncated in `ConsultPatientBanner.tsx`. |
| 17 | Optical alignment | Stable nav border widths, fixed-size icons, vertically aligned table cells, 44px form/menu/nav targets and wrapping action groups. Removed all nested Link/Button controls in doctor routes (baseline patient directory alone rendered 780 such elements). |
| 18 | Tabular numbers | Queue positions/counts, pagination, dates, table values and clinical measurement grid use tabular figures; patient identifiers and keyboard-shortcut hints retain mono. |
| 19 | Loading states | Added honest skeleton/loading, cancellation/race guards, initial/stale error + retry, empty/search-empty and pending-save states to appointments, directory/chart, profile, schedule and vitals. Dashboard failures no longer masquerade as zero revenue/empty queue; custom range errors are explicit. Vitals are keyed to the current booking to prevent stale route data. |
| 20 | Useful feedback animation | Existing pending Button/Toast feedback is reused, not decorative motion. Failed profile/schedule/vitals saves release pending state; vital entries remain available after failure. Doctor skeleton pulses become fully static with reduced motion, retaining visible loading text. |

Paths in this table are relative to `src/app/doctor/`, unless a component or token file is named. Components are under `src/components/doctor/`; shell navigation is `src/components/shell/Sidebar.tsx` and `src/lib/nav-config.ts`.

## Route coverage

| Route | Main changes |
|---|---|
| `/doctor/dashboard` | Real queue first, task header, reports collapsed, no invented shift, honest load failures, safe doctor destinations. |
| `/doctor/appointments` | Search/status/date scope, real dates, focus action, responsive cards/table, 20-row pagination, reload/error/empty states. |
| `/doctor/appointments/[id]` | Larger patient identity, real date/queue/payment metadata, valid single interactive links, unavailable-action clutter removed. |
| `/doctor/patients` | Deduplicated directory with genuinely latest appointment, 20-row pages, labelled search, chart-first navigation, loading/retry. |
| `/doctor/patients/[id]` | Larger wrapping identity, removed misleading badge, valid chart actions, recoverable fetch failure. |
| `/doctor/patients/[id]/prescriptions/create` | Patient-specific New prescription heading, persistent medication labels, explicit save and template actions. |
| `/doctor/patients/[id]/prescriptions/[prescriptionId]` | Patient-specific Edit prescription heading and same shared form improvements. |
| `/doctor/consultation/[bookingId]` | Legacy route retains canonical redirect, with meaningful opening status rather than blank output. |
| `/doctor/consultation/[bookingId]/vitals` | Real patient/ID/date context, current-booking isolation, loading/retry and shared vital-entry feedback. |
| `/doctor/consultation2/[bookingId]` | Readable identity/allergy banner, larger completed record, structured vital measures, task-specific document/amend header and clearer completion progress. |
| `/doctor/profile` | Persistent labels, meaningful header, removed inert photo UI, load recovery, validation/pending/error/saved feedback. |
| `/doctor/schedule` | Real availability only, labelled controls, load/save/block-date failures, no fake default working days, guarded affected-booking counts. |
| `/doctor/templates` | Specific heading/create actions, readable wrapping filters, selected-state semantics, corrected speciality-only empty/reset state. |
| `/doctor/settings` | Focused links to profile, availability and templates rather than duplicate management UI. |

## Verification

- Node 22.23.4 via nvm. Production build uses the existing `scripts/design-offline-guard.mjs` so build-time code cannot contact databases or remote services.
- `npm run test:unit`: 54 passing (38 existing + 16 doctor-specific tests). Includes natural prefixed queue sorting, immutable ordering, history dates, focus priority, patient/ID/queue search, truthful missing data, calendar validation, valid links, safety text and reduced motion.
- ESLint: passing, with 29 pre-existing warnings remaining; no lint errors. `git diff --check` passes.
- `scripts/verify-doctor-portal.mjs`: normal doctor login, all 14 routes at 1440px and 390px (28 route/viewport cases), actual local records, no horizontal overflow or nested main link/button controls, no uncaught browser errors. Also opens the consultation amendment workspace without editing or saving, checks search-empty/clear, failed refresh/retry, loading and reduced-motion skeleton feedback. Non-GET clinical writes are blocked; none attempted.
- Existing mutating clinical E2E suite deliberately not run. No saves, starts, completions, amendments, deletions, bookings or prescriptions were submitted. Save-failure handling is source/unit-reviewed, not live-write tested.

## Screenshots and preview

All paths below are Mac-local, under the main worktree; not uploaded or committed. `test-results/` is ignored because captures contain local development patient records.

- `test-results/doctor-portal/before-{route}-{1440|390}.png`
- `test-results/doctor-portal/after-{route}-{1440|390}.png`
- `test-results/doctor-portal/after-appointment-history-{1440|390}.png`
- `test-results/doctor-portal/after-consultation-editor-{1440|390}.png`
- `test-results/doctor-portal/after-appointments-refresh-error.png`
- `test-results/doctor-portal/after-appointments-loading-reduced-motion.png`
- `test-results/doctor-portal/after-results.json` contains the machine-readable read-only verification results.
- Additional original appointment history captures: `test-results/doctor-appointments/before-history-{1440|390}.png`.

`http://127.0.0.1:3001/doctor/appointments` now serves this **main worktree**, not the dirty original checkout. The old original FE and temporary 3002 preview were stopped; the local API on 5055 remains running. The original checkout's branch/files were not changed. To restart the new preview: `cd /Users/jessiejayrubi/Documents/Allyn/Project02-fe-doctor-main`, select Node 22.23.4 with nvm, then `npm run dev -- --hostname 127.0.0.1 --port 3001`.
