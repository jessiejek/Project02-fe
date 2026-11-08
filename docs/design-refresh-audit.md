# Project02-fe: 20-rule design audit

Scope: Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind v4 CSS theme, Font Awesome SVG icons. Public booking front door, login/register, and patient/staff/doctor/admin portals. Current branch authz-p0-hardening; origin/HEAD points to main. Preserve the existing teal clinical brand rather than importing Project01's purple palette.

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
