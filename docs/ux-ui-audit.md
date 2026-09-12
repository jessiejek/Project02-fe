# UX/UI Audit & Improvement Plan — Doctor Portal

Produced with the Intent design system (`/intent` → `/evaluate` → routed specialist skills). Analysis-only — no code changed. This is meant to be handed back to Claude a section at a time when you're ready to execute ("do #3", "do the Journey section", etc).

## Revision 2 (2026-09-12, re-walked after your latest commits through `f002775`)

Re-checked live against the dev server. Since the first pass you shipped: real-time SignalR updates for Staff Queue/Dashboard/Doctor Visits/Payments, payment status in the consultation header, a build-version footer, and a My Patients list-layout fix.

**Still open, now with sharper evidence** because the queue has real mixed-status data now (Q-001 Completed/Paid, Q-002 Checked In/Unpaid, Q-003 In Progress/Unpaid):
- **Item 3 (status filter on My Visits)** — confirmed still needed. Worse than I first flagged: Q-002 (Checked In) and Q-003 (In Progress) both show the *same* action label, "Start Consultation" — but one hasn't started and one is already underway. That's not just a missing filter, it's a **label that lies about state** (an "In Progress" visit shouldn't offer to "Start" it again — see new finding 3.1b below).
- **Item 2 (empty SOAP fields vs. "Not recorded." elsewhere)** — unchanged, still inconsistent.
- **Item 1.2 (view/amend button hierarchy)** — the intermediate booking-summary screen still exists separately from the full consultation view; not re-verified this pass, treat as open.

**New finding this pass:**

| # | Finding | Principle / Catalog ref | Severity |
|---|---|---|---|
| 3.1b | "In Progress" visits show a "Start Consultation" button — identical label to "Checked In" visits, which haven't started yet. A doctor scanning quickly can't tell, from the action alone, which patient is mid-consult (possibly with another provider or paused) vs. genuinely next up. | **Make intent visible** — a control's label is a promise about what happens next; "Start" on something already started breaks that promise. Also feeds `/organize` finding 3.1. | Medium-High |

Now that real-time infra exists (SignalR wired into Staff Queue/Dashboard already), the Dashboard redesign below leans on it directly rather than proposing new plumbing.

## Scope of this pass

I walked the **doctor** role live against your running dev server (logged in as Test Doctor): Dashboard, My Visits (queue), a completed consultation (view mode), the consultation amend/edit form, Settings (templates), Schedule, and Patients. I did not have credentials to walk **staff**, **patient**, or **admin** portals, so those are out of scope here — section 7 gives you the same method to run against them next.

## Project context (assumed from memory + code, flag if wrong)

- Single-doctor walk-in clinic, FCFS queue, no appointment slots. Mon–Fri 8–5, Sat 10–5. Flat fee schedule (₱450/400/350, +₱50 med-cert).
- Users are the doctor (fast, repetitive charting between patients) and front-desk staff (queue triage, payments) — not the general public in this portal.
- Vulnerable-population note: this is healthcare software. Even though it's not literally life-critical (walk-in clinic, not ER), errors in dosing, diagnosis codes, or fee capture have real consequences — treat charting flows with the same rigor as financial transaction flows.
- No stated ethical stance was given, so I'm defaulting to maximum protection: no dark patterns, honest defaults, accessible by default.

---

## 1. Findings — Doctor Consultation (view mode)

**Screen:** `/doctor/consultation/[bookingId]?mode=view`

| # | Finding | Principle / Catalog ref | Severity |
|---|---|---|---|
| 1.1 | Subjective / Objective / Assessment / Plan render as a bare label with nothing after it when empty — no dash, no "Not recorded." Meanwhile Prescriptions, Lab Orders, Vaccinations, Follow-up, and Professional Fee all show an explicit empty-state string ("None prescribed.", "Not recorded.") a few lines below. | **Inconsistent Patterns** (Anti-pattern Catalog, Cat. 9, Medium) — same "field has no data" situation handled two different ways on one screen. | Medium |
| 1.2 | "Edit / Amend" renders as the filled/primary green button and "View Consultation" as the plain outline button, on a screen the doctor lands on by clicking **View**. The action they didn't ask for is visually dominant. | Violates **make intent visible** / purpose clarity — the visually loudest control should match the likely next action, not the more consequential one by default. | Low–Medium |
| 1.3 | Patient identifier "MF-6987" still appears on the doctor-side chart/detail views, even though the walk-in **search** results dropped the MF-code line per a recent commit. Two representations of the same entity (with/without code) now coexist across the app. | **Inconsistent Patterns** (Cat. 9) — same identifier, different presentation depending on which screen you're on. | Low |

## 2. Findings — Consultation Amend/Edit form

**Screen:** `/doctor/consultation/[bookingId]?mode=amend` (9-section charting form)

| # | Finding | Principle / Catalog ref | Severity |
|---|---|---|---|
| 2.1 | A persistent amber banner reads "Manual save only — autosave is off in amend mode" and stays pinned at the top through the whole 9-section form. It's phrased as a warning (amber/⚠) but it's actually just stating a mode fact — amber signals risk, which primes anxiety on every scroll for a form the doctor will fill many times a day. | **Design for real conditions** (stress) + `/articulate` tone concern — warning-colored chrome for non-warning information trains doctors to either panic-check it or tune it out (the latter defeats real warnings later). | Medium |
| 2.2 | Two competing progress indicators sit next to each other in the header: a small "3/9" counter with a chart icon, and separately each section repeats its own "1/5"-style sub-counter. Neither is labeled, so a first-time or infrequent user (a locum doctor, a returning user after months) has to reverse-engineer what's being counted. | **Make intent visible** — purpose clarity. If you can't tell what a number means without hovering, it's decoration, not information. | Medium |
| 2.3 | "New Visit" / "Follow-up Visit" appears as two pill buttons directly under the patient's name/DOB, with no visible label explaining what selecting one does or what's currently selected (it's not clear which is "on" from text alone in the accessibility tree). | **Wayfinding** — a control with real consequence (probably affects templates or billing) needs a state that's obvious, not just colored. | Medium |
| 2.4 | A circular "?" icon button sits in the toolbar with no accessible name beyond "?". | Feeds directly into `/include` (Section 6 findings) but also an `/evaluate` heuristic gap: recognition over recall — an icon-only affordance for help needs a discoverable label. | Low |
| 2.5 | The form is a long single-column stack of 9 sections, each independently collapsible/expandable and independently savable — but there's no persistent "you are here" rail once you scroll past section 1, and no visible indicator of which sections already have data vs. are still blank. For a doctor moving fast between patients, "did I already fill in Prescriptions for this one?" is a real question with no fast visual answer. | **Organize** (structure) + **Design for real conditions** (distraction/interruption — doctor gets pulled away mid-chart and comes back). | High |

## 3. Findings — My Visits (queue) & Dashboard

| # | Finding | Principle / Catalog ref | Severity |
|---|---|---|---|
| 3.1 | My Visits has only a "Today / All" toggle and a text search box — no status filter (e.g. Waiting / In Progress / Completed) even though Status is a shown column. On a busier day with a real queue, scanning a flat list for "who's still waiting" doesn't scale. | **Organize** — filtering/faceting should exist wherever a list column encodes a state the user needs to act on. | Medium |
| 3.2 | Dashboard's "Practice Analytics" card mixes a time-range control (This Month/This Year/Custom Range) with only 3 stat tiles (Visits, Collected, Waived) and no trend/comparison ("vs last period"). A number with no reference point answers "what" but not "is that good?" | `/measure` — a metric without a baseline or comparison isn't yet a signal. | Low |
| 3.3 | Availability toggle ("Available / Running Late / Unavailable Today") lives on the dashboard, not the schedule page, even though Schedule Management explicitly says "day-to-day availability is set from the dashboard status toggle." That's honest and documented (good — this is *not* a dark pattern, just a slightly split IA), but a doctor who goes looking for it on the Schedule page first will bounce once before finding the note. | **Organize** — related controls split across two pages, bridged only by a text hint. | Low |

## 3b. Dashboard redesign — from "status page" to a real dashboard

You asked directly: is the current Dashboard actually a dashboard, or is it just there to look complete? Diagnosis first, then the redesign.

### Why it currently reads as "for compliance"

A dashboard earns the name when it answers "what do I need to know or do **right now**" at a glance. Today's screen answers a narrower question — "am I set up correctly" — which is a compliance/status question, not an operational one:

- **Greeting + shift time** — static, doesn't change all day.
- **Practice Analytics (Visits / Collected / Waived)** — an accounting reconciliation view. Useful once a day, at most, and only really useful to whoever does the books — not moment-to-moment doctor decisions.
- **Availability toggle** — a status flag the doctor sets and then forgets.
- **Working Schedule card** — static text, changes maybe weekly.
- **"Go to My Visits"** — a single button that hides the one thing that actually changes minute to minute (the live queue) behind a click.

Every module either (a) rarely changes, or (b) is a record-keeping number with no action attached. Nothing on the page updates itself, alerts the doctor to something, or shortcuts a decision. That's why it feels like a form you fill out once, not a tool you check between patients.

### What a real dashboard for this role should do

Reframe the question from "what statistics do we have" to **"what does this doctor need to glance at between patients, all day, without navigating away?"** For a solo walk-in doctor, that's almost entirely about the live queue and anything that needs their attention today — not trailing revenue totals.

You already have the infrastructure for this: the recent commit wiring SignalR into Staff Queue/Dashboard/Doctor Visits/Payments means the data this redesign needs (live queue state, per-visit timestamps, payment status) is already flowing in real time. This is a reorganization of what's shown, not new plumbing.

**Proposed structure, top to bottom, in priority order:**

1. **"Right now" — live queue strip** (new, replaces the static "Go to My Visits" button as the top module)
   Pulls from the same real-time channel already powering Staff Queue. Shows, without a click: how many patients are Waiting / Checked In / In Progress right now, and the next 1–3 patients in line with queue #, name, elapsed wait time, and a direct action (Start / Resume) — using the corrected labels from finding 3.1b so "Resume" and "Start" are never the same word for different states. This single module turns the dashboard into the doctor's actual first stop each morning and after every patient, because it's the one thing that's true *right now* and not five minutes ago.

2. **"Needs attention" — an exceptions module** (new)
   Surfaces things that would otherwise sit silent: visits marked Completed but still Unpaid, charts left without an Assessment/Plan (ties directly to finding 1.1 — an empty SOAP field is exactly the kind of thing that should surface here instead of only being discoverable by opening the chart), and follow-ups due today. This is the module that actually makes checking the dashboard worth doing — it's the difference between a dashboard and a compliance snapshot: a compliance page tells you the state of things; an exceptions module tells you what's wrong with the state of things.

3. **Availability toggle** — keep, but move it next to the live queue count instead of floating on its own ("3 waiting, longest wait 22 min" next to the Available/Running Late toggle gives the doctor the actual context that should inform the choice, instead of asking them to set status from a vacuum).

4. **Practice Analytics** — keep, but demote it below the fold and make it comparative, not absolute: add "vs. same period last month/year" (closes finding 3.2), and turn "Waived: ₱0" into a link-through list of which visits were waived and why, when the count is non-zero — a number alone answers nothing a front-desk audit would need; a list does.

5. **Working Schedule card** — keep as-is, lowest priority, it's reference information, not a decision aid. Fine to leave near the bottom or move to Schedule page only, since it's already duplicated with more detail there.

**What this costs:** module 1 (live queue strip) needs the SignalR queue events already used by Staff Queue to also feed a Doctor Dashboard subscription, plus corrected state labels (3.1b) so the strip's action buttons aren't misleading. Module 2 (exceptions) needs a query for "completed but unpaid" and "chart missing required fields," both of which are just filters on data you already capture — no new data model.

**Route for execution:** `/journey` to spec the live-queue-strip interaction and the exceptions module's triage flow, `/measure` to pick the right comparison window and define what counts as a "needs attention" condition without turning it into noise (a module that cries wolf gets ignored — same failure mode as the amber banner in finding 2.1), then `/wireframe` to lay out the new page hierarchy before touching code.

## 4. Findings — Settings (Templates) & Schedule

| # | Finding | Principle / Catalog ref | Severity |
|---|---|---|---|
| 4.1 | Settings page shows a full-width skeleton loading state (3 gray placeholder cards) before resolving. On a slow connection this could sit for a while with zero indication of what's loading or whether it's stuck. | **Design for real conditions** (slow networks) — a skeleton alone doesn't distinguish "loading" from "frozen" past a couple seconds; no timeout/retry affordance observed. | Low–Medium |
| 4.2 | Schedule Management's weekly-hours row uses raw checkbox + two time fields per day with no validation feedback visible in the UI for an inverted range (e.g., Tue currently reads 08:00–06:30, which is either a typo in test data or a state the form allows silently). | `/fortify` — if the form permits an end time before a sensible start without comment, that's a state inventory gap, not just a data quirk. | Medium |
| 4.3 | Templates (Settings) correctly separates "Saved diagnoses" from "Quick phrases," each with its own Edit/Delete — good pattern, no changes needed. Noting as a positive control point, not a finding. | — | — |

## 5. Cross-cutting findings

| # | Finding | Principle / Catalog ref | Severity |
|---|---|---|---|
| 5.1 | Empty-state copy is inconsistent app-wide: "Not recorded." / "None prescribed." / "None ordered." / "None administered." / "No follow-up scheduled." are four different sentence shapes for the same concept ("nothing here"), plus the SOAP fields that show nothing at all (see 1.1). | `/articulate` — this needs one voice pattern, not five, so doctors pattern-match instantly instead of re-reading each time. | Medium |
| 5.2 | Save affordances vary by context: whole-form "Save Changes" in the header, a "Save" per SOAP section, "Save as Template" inline — all green, all labeled "Save*", differentiated only by scope. Given a recent commit already unified loading-state behavior across these, the remaining gap is purely textual/positional disambiguation, not behavior. | `/articulate` + `/journey` — label text should make scope explicit ("Save section" vs "Save all changes") since color/position alone is a lot to ask a fast-moving user to track across 9 sections. | Low |

---

## Revision 3 (2026-09-12) — implementation pass

All 13 items below were executed, with two deliberately skipped and one downsized after finding they conflicted with, or were already covered by, decisions already baked into the codebase. Each was verified live against the running dev server, not just read from source.

**Two items were NOT changed, on purpose:**
- **Item 1 (Dashboard) and item 6 (button hierarchy)** both turned out to collide with prior, deliberate, documented decisions:
  - The dashboard used to have almost exactly the "live queue + needs attention" layout proposed here — commit `ec14ff4` ("Doctor dashboard: pure analytics, not a second patient queue") explicitly removed it because mixing "practice analytics" and "who's next" confused the doctor. You reviewed this and chose to go ahead with the redesign anyway (built with a clear visual/heading separation between "Right now" and "Practice Analytics" so the two jobs stay legible as two different things, addressing the original complaint directly rather than ignoring it).
  - Item 6 (View/Edit button weight) was left **unchanged** — `src/app/doctor/appointments/[id]/page.tsx` has a first-commit comment stating the secondary/primary weighting is deliberate, per an original "UX Redesign Proposal" not in this repo. You chose to keep it as designed.
- **Item 3 (progress rail) was downsized, not built from scratch.** Reading the actual code showed a persistent per-section completion system already exists: a header button showing sections-complete (e.g. "3/9"), a dropdown listing all 9 sections with live status icons, and a live "filled/total" fraction on SOAP/Vitals/Follow-up while in progress. The real gap was just that neither counter had an accessible name — fixed with `title`/`aria-label` on both, not a rebuild.
- **Item 9 (schedule validation) needed no change.** `handleSave` in `src/app/doctor/schedule/page.tsx` already validates end-time > start-time before saving and surfaces a real error message. The bad test data seen in the original audit (Tue 08:00–06:30) predates that validation being exercised — confirmed working as designed.
- **Item 10 ("?" icon) needed no change.** The help button already has `aria-label="Keyboard shortcuts help"` in code — the original finding was based on stripped page text, not the actual accessibility tree.
- **Item 11 (MF-code) needed no change.** The doctor-side chart/patient views showing the code and the staff walk-in search hiding it are two different contexts with different needs (clinical record-linking vs. quick-scan search) — not the same inconsistency once you look at *why* each screen shows what it shows.

**What actually shipped:**
1. **Dashboard**: new "Right now" card (live queue strip via the existing `useClinicHubEvent`/`queryQueue`, sorted up-next list, state-correct Start/Resume buttons), a "Needs attention" card (unpaid-after-completion + incomplete-chart links, refreshing on `PaymentUpdated`/`QueueUpdated`), Availability moved next to a live wait-time context line, and a "vs last month" delta on Collected.
2. Fixed the Start/Resume label bug in both the dashboard and My Visits (desktop + mobile card views).
3. Added accessible labels to both progress counters (see downsizing note above).
4. Unified empty-state copy in the consultation view: SOAP fields now say "Not recorded." instead of rendering blank; list sections standardized to "No _____ recorded."
5. Added a status filter (All / Waiting / In progress / Completed) to My Visits.
7. Amend-mode banner switched from `warning` (amber) to `info` (blue) — same component, one prop change.
8. Added `aria-pressed` to the New Visit/Follow-up Visit toggle so its state reaches assistive tech, not just color/border.
13. Added a "still loading" message on Settings after 6 seconds, so a slow connection doesn't look indistinguishable from a stuck one.

Verified via the dev server: dashboard live queue + needs-attention render correctly against real seeded data (Eduardo Cruz CheckedIn → "Start Consultation", Nicole Ramos InProgress → "Resume Consultation", Ramon Villanueva's blank-SOAP visit surfaced under Needs Attention); My Visits status filter correctly isolates each state; consultation banner renders blue; `aria-pressed` confirmed via direct DOM inspection; Settings loads cleanly with the new code path. `tsc --noEmit` and `eslint` clean on every touched file (two pre-existing lint findings in untouched code — `appointments/page.tsx:58` and `schedule/page.tsx:100` — were not introduced by this pass and were left alone since they were out of scope).

## 6. Prioritized action list, routed to the skill that executes it

Ordered by (severity × how often a doctor hits the screen). "High" first. Renumbered in Revision 2 to fold in the Dashboard redesign and the sharpened queue-label finding.

1. **[High] Dashboard redesign — live queue strip + exceptions module** (Section 3b) — route to **`/journey`** for the interaction spec, **`/measure`** for what counts as "needs attention" without crying wolf, **`/wireframe`** for layout. This is the highest-leverage item: it's checked dozens of times a day and currently returns almost nothing actionable.
2. **[High] Fix the "Start Consultation" label on In Progress visits** (3.1b) — route to **`/articulate`** for correct state labels (Start vs. Resume/Continue) + **`/journey`** to confirm the underlying action is actually safe to re-trigger on an in-progress visit.
3. **[High] Add an in-form progress/completion rail for the 9-section consultation form** (2.5) — route to **`/journey`** to redesign the section-navigation model, then **`/wireframe`** to lay out a persistent "you are here + what's filled in" rail.
4. **[Medium] Unify empty-state copy everywhere** (1.1, 5.1) — route to **`/articulate`** to define one voice pattern for "nothing recorded yet" and apply it to SOAP fields, prescriptions, labs, vaccinations, follow-up, fee. (Also feeds the dashboard's exceptions module — an empty Assessment/Plan should surface there, not just render quietly blank.)
5. **[Medium] Add status filtering to My Visits** (3.1) — route to **`/organize`** for the filter/facet model (Waiting/In Progress/Completed at minimum).
6. **[Medium] Fix the view/amend button hierarchy** (1.2) — route to **`/journey`** — the primary-styled action on a "view" screen should match the likely next step, not just the more powerful one.
7. **[Medium] Re-tone the amend-mode banner** (2.1) — route to **`/articulate`** — keep the information, drop the warning-colored chrome; reserve amber/red for things that need doctor attention *now*.
8. **[Medium] Label the two progress counters and the New/Follow-up toggle's current state** (2.2, 2.3) — route to **`/journey`** for the interaction spec, **`/include`** to confirm the state is exposed to assistive tech, not just color/position.
9. **[Medium] Validate schedule time ranges** (4.2) — route to **`/fortify`** for the full state inventory (what should happen on an inverted range, a blank end time, overlapping blocked dates).
10. **[Low] Give the "?" help icon a real accessible label** (2.4) — route to **`/include`**.
11. **[Low] Reconcile the MF-code identifier's presence/absence across screens** (1.3) — route to **`/organize`** (this is really "what identity info shows where," a taxonomy question) with a light **`/articulate`** pass on the label itself.
12. **[Low] Bridge Schedule → Dashboard for the availability toggle** (3.3) — now largely subsumed by item 1 (the redesign puts availability next to live queue count), keep only if item 1 is deferred.
13. **[Low] Add a stuck-loading fallback on Settings** (4.1) — route to **`/fortify`** for the state (loading → slow → failed → retry).

## 7. How to extend this to Staff / Patient / Admin

Same method, three portals, same checklist:
1. Log in as that role (staff / patient / admin test account).
2. Walk the 5–8 highest-traffic screens for that role (for staff: queue, walk-in intake, payments; for patient: booking/dashboard, bookings detail, prescriptions; for admin: dashboard, bookings, reports).
3. Screenshot + read the actual rendered text (not just the code) for each — the point is catching what a real user sees, including loading/empty states, not just what the component *should* render.
4. Score each screen against the Anti-Pattern Catalog (Categories 1–10) and the six core principles (autonomy, real conditions, visible intent, evidence, systems, ethical defaults).
5. File findings in the same table shape as above, route each to the owning skill.

## 8. `/journey` spec — Doctor Dashboard live queue + needs-attention modules

This is the concrete interaction spec for item #1 in Section 6, grounded in the actual code (not guessed): `src/lib/realtime/clinicHub.ts`, `src/lib/data/queue.ts`, `src/lib/data/bookings.ts`, and the existing pattern in `src/app/doctor/appointments/page.tsx`.

### What already exists (confirmed by reading the code, not assumed)

- **`useClinicHubEvent(event, callback)`** in `src/lib/realtime/clinicHub.ts` — a generic "subscribe, refetch on fire" hook. Events are payload-less triggers: `"PatientCheckedIn"`, `"QueueUpdated"`, `"PaymentUpdated"`. Server assigns the doctor's group from the JWT, so a new Doctor Dashboard widget can call this hook directly with **zero new wiring** — no group ID to pass, no new hub method.
- **`doctor/appointments/page.tsx`** already does exactly this pattern for My Visits: subscribes to `PatientCheckedIn` (when viewing "today") and `QueueUpdated`, and refetches on either. The dashboard's live queue strip reuses this same pattern verbatim.
- **`QueueEntry`** (`src/lib/data/queue.ts`): `booking_id, queue_number, patient_id, patient_name, patient_code, status, visit_type, amount_due, checked_in_at`. **`QueueBoard`**: `date`, `summary: {waiting, in_progress, completed, no_show, total}`, `items: QueueEntry[]`. The `summary` object already gives the dashboard its top-line counts for free — no new aggregation needed.
- **`status`** is a free-form string, observed values include `Confirmed`, `CheckedIn`, `Completed`, `No-Show`, and (seen live in the running app) `In Progress`. **Payment status** comes from `BookingPaymentEmbed.status`, observed `Unpaid`, or a fallback default of `Unpaid` when absent.

### 1. Problem statement

The doctor currently has no reason to look at `/doctor/dashboard` after the first glance of the day — it shows static schedule info and a revenue total, then the doctor navigates away to My Visits and stays there. Success looks like: the dashboard becomes the doctor's actual home base between patients, because it's the fastest way to see who's next and what needs attention — faster than opening My Visits and re-reading the whole table.

### 2. User context

Single user type here: the doctor, mid-shift, moving between patients in a walk-in clinic with no appointment slots. They check the dashboard in short glances (seconds, not focused sessions), often right after finishing one consultation and before calling the next patient in. Design for glanceability, not deep reading.

### 3. Screen-by-screen

**State A — Dashboard load, queue has activity today**
- Top module, "Right now": a summary bar built directly from `QueueBoard.summary` — `Waiting 2 · In Progress 1 · Completed 3` — plus the Availability toggle folded into the same header row (was its own separate card; now it sits where its context is, per finding 3.3).
- Below the summary bar: up to 3 "up next" cards, sorted by `queue_number` ascending, filtered to `status` in `{CheckedIn, In Progress}` (i.e., `Confirmed` and terminal states never appear here — a walk-in that hasn't checked in yet has nothing for the doctor to do, and `Completed`/`No-Show` are done). Each card shows: `queue_number`, `patient_name`, a `visit_type` tag (New/Follow-up), and elapsed wait computed client-side from `checked_in_at` ("Waiting 12m") for `CheckedIn` rows.
- Action button label is **state-derived, not one fixed string** — this directly fixes finding 3.1b:
  - `status === "CheckedIn"` → button reads **"Start Consultation"**, links to `/doctor/consultation/{booking_id}?mode=amend`.
  - `status === "In Progress"` → button reads **"Resume Consultation"**, same route — same destination, different label, because the doctor needs to know at a glance whether they're starting fresh or picking a draft back up.
- If `Waiting + In Progress === 0` and `Completed > 0`: empty state reads "Queue's clear — N seen today," not a bare blank card (avoids Dead Ends, Anti-Pattern Catalog Cat. 9).
- If `total === 0` (before the first check-in of the day): empty state reads "No one's checked in yet today."

**State B — A SignalR event fires while the doctor is looking at the dashboard**
- `PatientCheckedIn` or `QueueUpdated` fires → refetch the board (same call already used for the initial load, same pattern as `doctor/appointments/page.tsx`) → the summary bar counts and the up-next list update in place.
- New or reordered cards fade/slide in over ~200–250ms (Journey standard for feedback loops) so a doctor glancing over mid-motion notices *something changed* without a jarring full-page flash. No sound, no browser notification — this is a passive surface, not an interrupt (keeps it out of Notification Spam / Attention Bait territory, Cat. 5).

**State C — "Needs attention" module**
- Sits directly below the queue strip. Two list types, each capped at 5 visible rows with a "+N more" link through to the filtered My Visits / Payments view (not an infinite list dumped on the dashboard):
  - **Unpaid after completion**: bookings where `status === "Completed"` and payment status is `Unpaid` (or absent). Refetches on `PaymentUpdated` and `QueueUpdated`.
  - **Incomplete charts**: `Completed` encounters missing Assessment/Plan text — this is the same gap as finding 1.1, surfaced proactively instead of only discoverable by opening each chart.
- Each row is a link straight into the relevant screen (payment collection or the consultation in amend mode) — no dead-end list, every row is actionable in one click.
- If both lists are empty: the whole module either collapses to a single quiet line ("Nothing needs attention") or hides entirely — an empty "needs attention" box that's *always* visible starts to read as decoration and gets ignored (same failure mode as a banner that's always amber, finding 2.1).

**State D — Existing modules, demoted not removed**
- Practice Analytics moves below the fold, gains a "vs. last period" comparison (closes finding 3.2).
- Working Schedule card stays, lowest priority, since it's identical reference info to the Schedule page and rarely changes.

### 6. Interaction specifications

- **Loading**: skeleton state on first load only (not on every SignalR refetch — refetches update in place without a loading flash, since the data is usually already cached and this avoids a flicker every time a patient checks in). Add a stuck-state fallback if the initial fetch exceeds ~5s: "Taking longer than usual — Retry" (closes finding 4.1's underlying pattern, applied here too).
- **Accessibility**: state changes in the queue strip should be announced via an `aria-live="polite"` region (a new "In Progress" card appearing shouldn't require the doctor to be looking at the screen at that exact moment, but also shouldn't interrupt like `assertive` would) — flag for `/include` to confirm before implementation.
- **Undo/reversibility**: N/A for this module — it's read/navigate only; no destructive action lives here.

### 9. Flow metrics & success criteria

- Primary: reduction in clicks-to-start-next-consultation (today: Dashboard → My Visits → find row → Start ≈ 3–4 actions; target: Dashboard → Start ≈ 1 action).
- Secondary: does the "needs attention" list actually get cleared during the day, or does it accumulate untouched? If it accumulates, either the threshold is wrong or the list is being ignored — re-open `/measure` rather than assuming the module failed.

### 10. Pending questions (for you or a follow-up `/blueprint` pass — not assumed here)

1. Does the booking/consultation API already expose a "chart complete" flag, or does "Incomplete charts" need to be inferred client-side from empty Assessment/Plan text? The inventory didn't confirm this either way.
2. Is there a follow-up-due-date field in the current data model at all? Section 3b of this doc mentioned "follow-ups due today" as a candidate needs-attention item — I found no such field in `QueueEntry`/`BookingRow` during this pass, so treat that specific item as **not yet buildable** until confirmed, separate from the two items above which are backed by fields that do exist.
3. Confirm server-side: is the doctor's SignalR group genuinely scoped by JWT (so a dashboard widget "just works" with no query param), or does `doctor/appointments/page.tsx` do something dashboard would also need to replicate? Worth a quick source check on the hub itself (not just the client) before implementation.

### Diagram

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
:root {
  --bg: #fafafc; --surface: #ffffff; --fg: #18182b; --fg-muted: #65657a;
  --border: #d8d8e4; --accent: #4338ca;
  --sans: "Hanken Grotesk", Inter, system-ui, -apple-system, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, monospace;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px;
  --s5: 20px; --s6: 24px; --s7: 32px; --s8: 48px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #18182b; --surface: #1f1f36; --fg: #f0f0f8; --fg-muted: #8888a8;
    --border: #2a2a44; --accent: #7c6ff0;
  }
}
* { box-sizing: border-box; }
body {
  font-family: var(--sans); background: var(--bg); color: var(--fg);
  padding: var(--s7); line-height: 1.5; margin: 0;
}
.visual-diagram {
  margin: 0; padding: var(--s5);
  background: var(--surface); border-radius: 8px;
  border: 1px solid var(--border); overflow-x: auto;
}
.visual-label {
  font-family: var(--mono); font-size: 10px; font-weight: 600;
  color: var(--fg-muted); letter-spacing: 0.06em;
  margin-bottom: var(--s4); text-transform: uppercase;
}
.flow-grid {
  display: grid;
  grid-template-columns: auto 16px 1fr 16px 1fr 16px 1fr 16px 1fr 16px 1fr;
  align-items: center; padding: var(--s3) 0; row-gap: var(--s2);
}
.flow-node {
  padding: var(--s2); background: var(--bg);
  border: 1px solid var(--border); border-radius: 4px;
  text-align: center; min-width: 0;
}
.flow-node-step { font-family: var(--mono); font-size: 10px; font-weight: 600; color: var(--accent); margin-bottom: 1px; }
.flow-node-label { font-size: 11px; font-weight: 600; color: var(--fg); }
.flow-node-detail { font-size: 10px; color: var(--fg-muted); margin-top: 1px; }
.flow-node-icon { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--accent); }
.flow-start { border-color: var(--accent); border-width: 2px; padding: var(--s2) var(--s3); }
.flow-end { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--bg)); }
.flow-arrow { height: 1px; background: var(--border); position: relative; }
.flow-arrow::after {
  content: ''; position: absolute; right: 0; top: -3px;
  border-left: 4px solid var(--border);
  border-top: 3px solid transparent; border-bottom: 3px solid transparent;
}
.flow-gate { text-align: center; padding-top: var(--s1); }
.flow-gate-connector { width: 1px; height: 10px; background: var(--border); margin: 0 auto; }
.flow-gate-diamond {
  width: 10px; height: 10px; background: var(--surface);
  border: 1px solid var(--border);
  transform: rotate(45deg); margin: 0 auto 4px;
}
.flow-gate-label { font-size: 10px; font-weight: 600; color: var(--fg-muted); }
.flow-gate-action { font-size: 10px; color: var(--fg-muted); opacity: 0.6; }
.flow-metric { margin-top: var(--s3); padding-top: var(--s3); border-top: 1px solid var(--border); font-size: 11px; }
.flow-metric-value { font-weight: 600; color: var(--accent); }
.flow-metric-label { color: var(--fg-muted); }
</style>
</head>
<body>
<div class="visual-diagram">
  <div class="visual-label">Flow: Doctor Dashboard — Live Queue + Needs Attention</div>
  <div class="flow-grid">
    <div class="flow-node flow-start">
      <div class="flow-node-icon">▶</div>
      <div class="flow-node-label">Doctor opens Dashboard</div>
    </div>
    <div class="flow-arrow"></div>
    <div class="flow-node">
      <div class="flow-node-step">1</div>
      <div class="flow-node-label">Fetch QueueBoard</div>
      <div class="flow-node-detail">summary + items, today</div>
    </div>
    <div class="flow-arrow"></div>
    <div class="flow-node">
      <div class="flow-node-step">2</div>
      <div class="flow-node-label">Render "Right now"</div>
      <div class="flow-node-detail">Waiting/InProgress/Completed + up to 3 cards</div>
    </div>
    <div class="flow-arrow"></div>
    <div class="flow-node">
      <div class="flow-node-step">3</div>
      <div class="flow-node-label">Doctor taps card action</div>
      <div class="flow-node-detail">Start (CheckedIn) or Resume (In Progress)</div>
    </div>
    <div class="flow-arrow"></div>
    <div class="flow-node flow-end">
      <div class="flow-node-step">4</div>
      <div class="flow-node-label">Consultation (amend)</div>
      <div class="flow-node-detail">/doctor/consultation/{id}</div>
    </div>
    <div class="flow-gate" style="grid-column: 5; grid-row: 2;">
      <div class="flow-gate-connector"></div>
      <div class="flow-gate-diamond"></div>
      <div class="flow-gate-label">Hub event fires?</div>
      <div class="flow-gate-action">PatientCheckedIn / QueueUpdated → refetch step 1, in place</div>
    </div>
    <div class="flow-gate" style="grid-column: 3; grid-row: 4;">
      <div class="flow-gate-connector"></div>
      <div class="flow-gate-diamond"></div>
      <div class="flow-gate-label">Completed + Unpaid, or chart incomplete?</div>
      <div class="flow-gate-action">→ "Needs attention" list, links to Payments / chart</div>
    </div>
  </div>
  <div class="flow-metric">
    <span class="flow-metric-value">~1 action</span>
    <span class="flow-metric-label">Dashboard → Start Consultation (was 3–4 via My Visits)</span>
  </div>
</div>
</body>
</html>
```

**Handoffs from here:** `/wireframe` to lay out the actual card/module positions and spacing (this spec defines what exists and why, not pixel layout); `/articulate` for the exact copy strings (empty states, button labels, "needs attention" row phrasing); `/include` to confirm the `aria-live` approach and card focus order; `/fortify` to define what happens if the SignalR connection drops mid-shift (does the dashboard silently go stale, or show a "reconnecting" state?) — not covered in this pass.

## 9. When you're ready to execute

Tell me which numbered item(s) from Section 6 to do first (or say "start from the top"), and which skill should lead — I'll open that skill, produce the concrete redesign/copy/spec, and only then touch code once you sign off on the direction.
