# Project02-fe: 20-rule design audit

Scope: Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind v4 CSS theme, Font Awesome SVG icons. Public booking front door, login/register, and patient/staff/doctor/admin portals. Current branch authz-p0-hardening; remote default main (verified from GitHub repository metadata, not develop). Preserve the existing teal clinical brand rather than importing Project01's purple palette.

Initial findings (before the three implementation batches):
1. Filler badges: no unsupported HIPAA/rating marketing badges found; redundant Admin role badge in admin/dashboard duplicates context.
2. Redundant labels: patient/dashboard StatCard eyebrows Today/Pending/History/Active repeat or overstate values.
3. Italics: DoctorTemplatesPanel's empty preview uses arbitrary italics.
4. Mono: IDs and keyboard shortcuts are appropriate; audit-log timestamps can use sans/tabular numerals.
5. Design system: globals.css theme and ui primitives already exist; StatCard and StatusPill need consistent semantic tokens and contrast.
6. Actual product: homepage describes the actual queue workflow; dashboards use data-query helpers, not hardcoded revenue charts. Keep that. Remove the patient dashboard's inert download control.
7. Main feature: next appointment appears after metrics and directory on mobile; promote it.
8. Spacing: shared scale exists; patient quick actions hide a long horizontal rail. Wrap the actions.
9. Headlines: generally specific; Your Appointment Today is inaccurate for a future booking. Generic health-status copy does not describe the actual metrics.
10. CTA: shared Button variants are sound; preserve one main action and fix nested interactive elements on patient dashboard.
11. Accent: teal already established. Keep semantic warning/error/success colors, not an arbitrary new brand.
12. Icons: bundled Font Awesome adapter already consistent; BookingTimeline uses a text checkmark instead of the adapter.
13. Embellishments: bento-card lifts even when not interactive; make feedback conditional on interactivity.
14. Radius: card outer 24px / padding 24px / inner icon 16px are unrelated surfaces, not concentric borders. Add a deliberate inset surface token for closely nested surfaces instead of applying subtraction indiscriminately.
15. Contrast: StatCard eyebrow uses 60% text opacity; templates and empty controls also fade readable copy.
16. Wrapping: no balanced headlines found.
17. Alignment: flex centering generally fine; DataTable's clickable rows/mobile cards are missing keyboard affordances. Tabs indicator only measures on active changes, not resizing.
18. Numbers: no tabular numeric treatment found.
19. States: skeletons and button loading exist; admin and patient dashboard rejected requests can leave loading forever. Public hours/fees disappear on failure. Add explicit failures/retries and route fallbacks.
20. Motion: global reduced-motion handling and feedback animation already exist; preserve them, disable static skeleton shimmer for reduced motion, and announce loading without relying on a spinner.

Plan: quick content/hierarchy/typography fixes; shared token/interaction consistency; explicit request and route states with offline verification. No database connections, pushes, or fabricated claims/data. Pre-existing dirty config/package/API/proxy files are excluded from these commits.

## Screens and existing system
57 page routes: public queue/booking information and authentication; admin scheduling, directory, reports, settings and audit; staff queue, walk-in, bookings and payments; doctor appointments, consultations, prescriptions, templates and schedule; patient bookings, directory, records, prescriptions, documents, labs, vaccines and consent.

Existing CSS-native Tailwind theme in `src/app/globals.css`, shared `src/components/ui` primitives and the Font Awesome `Icon` adapter remain the system of record. Native sans fonts remove a build-time Google-font dependency; mono remains for IDs/code.

## Implemented batches
- Quick wins (manual scope estimate: 1–2 hours): remove duplicate labels/unsupported dashboard wording, promote the next appointment, replace an inert download with real records navigation, balance headings and use tabular figures. Commit `81705da`.
- Tokens/consistency (2–4 hours): semantic status text/surface/border tokens; one shared button/link style; inset radius; consistent timeline icons; interactive-only card lift; keyboard-accessible rows/cards/tabs and ResizeObserver cleanup. Commit `d6369d7`.
- UX states/reduced motion (3–5 hours): dashboard error/retry/cancellation; no zero totals on failed loads; distinguish unavailable ratings from no reviews; public details unavailable/reload states; missing fees/days are not invented; route loading/error fallbacks; announced pending states, duplicate-send prevention and truthful verification-request feedback. Root retry uses Next 16.2's `unstable_retry`.

No unsupported HIPAA/licensing/rating marketing badge or fake revenue chart was found in Project02. Retained API-backed values and meaningful operational status pills; no replacement numbers were fabricated. Renamed the doctor-load chart to describe its actual latest-20-booking scope.

## Verification boundaries
Story: public clinic page → deliberately blocked settings/hours requests → honest unavailable UI → reload/pending feedback → same unavailable state, including mobile and reduced motion. Production builds run with `scripts/design-offline-guard.mjs`, which rejects outbound HTTP/TCP before the app loads. Browser smoke uses a fresh isolated context, aborts API requests (including the footer's version request), and never signs in.

No database or backend integration is exercised. The existing `e2e/playwright.config.ts` explicitly requires a live .NET API and SQL Server and includes mutating journeys, so that suite is intentionally skipped. Authenticated portal data flows are source/compile/unit verified, not live-data browser verified. No credential values or saved browser sessions were inspected; Next loads its existing environment normally, while the verification preload prevents network access.

## Final results
Using installed Node 22.23.4 via nvm (no .nvmrc or package engines are declared):

| Batch | Production webpack build | Unit tests | ESLint |
| --- | --- | --- | --- |
| Quick wins | Passed | 27/27 | 0 errors, 42 pre-existing warnings |
| Tokens/consistency | Passed | 30/30 | 0 errors, same 42 warnings |
| UX states/reduced motion | Passed | 38/38 | 0 errors, same 42 warnings |

All batches pass `git diff --check`. Additional offline Playwright verification passes 6/6 cases: widths 320, 390 and 1440, each with normal/reduced motion; no horizontal overflow or browser errors; retry visibly enters/exits pending; balanced headings; no API requests are allowed through. Evidence: `test-results/design-refresh-bkqCWi` (results JSON, screenshots, server and traffic logs). Semantic status text/surface token pairs also pass AA 4.5:1 unit checks.

Re-run: `NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--import=$PWD/scripts/design-offline-guard.mjs" npm run build -- --webpack`, then `npm run test:unit`, `npm run lint`, and `node scripts/verify-design-offline.mjs`. The browser script starts/stops only its own isolated localhost Next process; no background server is left running. No push performed. Pre-existing dirty tracked/untracked work was preserved and excluded from the three design commits.
