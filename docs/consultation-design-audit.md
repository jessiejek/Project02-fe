# Consultation workspace deep design pass

Scope: `/doctor/consultation2/[bookingId]` and its patient header, clinical notes, vitals, prescription, orders, history and action components. Other portals were deliberately not started. Existing doctor portal changes are retained.

Stack: Next.js App Router, React, TypeScript and Tailwind; shared Button/Card/Modal/Icon components and existing semantic surface, spacing, radius and status tokens. No additional UI library or new brand palette.

| Rule | Before → after |
| --- | --- |
| 1. Delete filler badges | Repeated Required pills and partial numeric badges → quiet text/progress; retain meaningful allergy and clinical safety warnings. |
| 2. Drop redundant labels | Duplicate header/footer saves, progress dropdown and mobile section stepper → one task navigation and one action footer; explicit persistent field labels remain. |
| 3. Unitalicize random words | Already fine: no decorative italics in this workspace; retained. |
| 4. Mono only where needed | Already fine: monospace reserved for patient code and keyboard shortcuts, not body text or measurements. |
| 5. Use a design system | Ad hoc status colors and nested raised cards → existing semantic status tokens, shared controls and workspace-scoped geometry. |
| 6. Show the actual product | Real patient chart and editable clinical record stay central; no invented findings, sample vitals or decorative mockups. |
| 7. Enlarge the main feature | Narrow SOAP beside a second 15rem rail → full-width workspace, chief complaint spanning the grid and larger two-column S/O/A/P editors. |
| 8. Group with spacing | Stacked collapsed cards and boxed toolbar → one active panel, quiet collapsed template tools, consistent gaps and flattened nested editor cards. |
| 9. Specific headlines | “Document consultation” / “Amend consultation” and “Clinical notes” identify the task; persistent field labels identify each clinical entry. |
| 10. Emphasize the CTA | Competing save controls → Save draft is primary until completion requirements are met; then Review & complete is primary and Save draft secondary. Embedded vitals/medication/order actions are secondary. |
| 11. One accent colour | Existing brand primary remains the interaction accent; warning/danger/success colors communicate clinical state only. The selected New/Follow-up visit option has a solid brand background and white text; its unselected peer remains a neutral outline. |
| 12. Consistent icons | Shared Icon component retained throughout; task status icons, phrase controls and action icons use consistent sizes/alignment. |
| 13. Remove embellishments | Raised card-within-card layers, unavailable print controls and a large boxed template toolbar → flat surfaces, useful controls and compact disclosure. |
| 14. Radius math | Workspace panel 24px radius − 16px padding = 8px input corners; redundant inner card boundaries removed. |
| 15. Text contrast | Strong persistent labels, readable hints, semantic warnings and neutral empty clinical sections; no meaning conveyed by color alone. |
| 16. Headline wrapping | Balanced task headline; inherited doctor heading rules retained. Mobile task navigation scrolls instead of forcing a narrow document column. |
| 17. Optical alignment | Persistent label/tool rows, stable icon sizes, aligned grid fields and a 44px help target; phone layout has no horizontal page overflow. |
| 18. Tabular nums | Workspace inputs, clinical measurements, dosages, history, patient metadata and save times use tabular figures without monospace prose. |
| 19. Loading states | Retain page/vitals loading states; phrase loading/error states, recoverable history failure, duplicate-save guard and persistent saving/unsaved/error feedback. |
| 20. Useful feedback animation | Quiet save status and real busy buttons instead of repeated success toasts; task color transitions only, disabled motion when reduced motion is requested. |

## Save safety

The old 30-second timer could call a stale save closure even when no form field had changed. It now calls the latest handler only for a dirty, idle, unfinished visit. Keyboard save also uses the current handler. A saved snapshot is acknowledged only after persistence succeeds, so edits made during a save still show as unsaved. Existing completion, required-section, allergy/NKDA, medication and follow-up confirmation gates remain intact.

## Verification

Verified with Node 22.23.4 via nvm:

- Production build: `NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--import=$PWD/scripts/design-offline-guard.mjs" npm run build -- --webpack` passed without network/API access.
- `npm run test:unit`: 64/64 passed, including five new consultation design/save-safety tests.
- `npm run lint`: passed, 0 errors / 34 pre-existing warnings. `git diff --check`: passed.
- Guarded local browser: 1440px and 390px, no horizontal page overflow; desktop chief editor width 1098px. All nine task panels, prescription templates and all six history tabs inspected. Exactly one primary action in each main panel.
- An untouched visit was observed across a full 31-second autosave interval: zero attempted clinical writes. No uncaught UI errors.
- History loading, simulated read-only HTTP 503, successful retry and reduced-motion mode verified.
- Live clinical Save/Complete/Print/prescription actions and the mutating clinical E2E suite were deliberately not run.

Screenshots are in `test-results/consultation-design/` (ignored generated artifacts), including `before-consultation-1440.png`, `after-consultation-1440.png`, `after-consultation-390.png` and `after-soap-1440.png`.

Browser verification uses the local Test Patient visit only. It does not type clinical fields, click Save/Complete/Print, create prescriptions or contact a remote service. All non-auth clinical writes are intercepted and rejected as a safety guard.
