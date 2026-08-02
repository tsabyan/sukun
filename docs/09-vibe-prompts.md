# 09 — Vibe Coding Prompts

One prompt per roadmap phase. Copy-paste as-is.

## How to use these

1. **One phase per agent session.** Clear context between phases. A fresh session re-reads the docs; a long one drifts from a half-remembered version of them.
2. **Every prompt starts by naming the docs to read.** Don't paste the docs — the agent should read them from disk so it can re-check details mid-task.
3. **After each phase:** run the done-criteria from [07](07-roadmap.md), then commit and tag.
4. **When the agent goes off-spec,** don't argue with the output. Say `That contradicts docs/04-design-system.md §3. Re-read it and fix.` Pointing at the doc works; describing the problem invites improvisation.

---

## Phase 0 — Foundation

```
Read docs/02-architecture.md and docs/04-design-system.md in full before writing code.

Set up the Next.js 15 project in this directory:
- create-next-app: TypeScript strict, Tailwind v4, App Router, src/ dir, @/* alias
- Fonts via next/font/google: Archivo Variable and Instrument Sans Variable, both
  self-hosted with display swap
- src/styles/globals.css: every design token from doc 04 as CSS custom properties.
  Light and dark blocks, plus the three [data-phase] accent overrides. Wire them
  into Tailwind v4's @theme block.
- Theme system: data-theme on <html>, a blocking inline script in <head> that reads
  localStorage then prefers-color-scheme before first paint, and a useTheme hook.
- The Daylight background layer from doc 04 §1, driven by local hour.
- Base components in src/components/ui/: Button (4 variants), Card, Sheet (bottom
  sheet with snap points and drag-to-dismiss), SegmentedControl (Motion layoutId
  thumb), Toggle, Field, IconButton, Pill. Use Motion with the spring tokens from
  doc 04 §4. Respect prefers-reduced-motion.
- App shell: bottom tab bar on mobile with safe-area inset, left rail at ≥1024px.
  Tabs: Timer, Plan, Tasks, Report.
- Logomark component per doc 04 §0.1: one SVG circle, 40° gap opening at the
  top-right from 12 o'clock, round caps, stroke = currentColor so it inherits
  --accent and re-tints with the timer phase. Plus the side-by-side wordmark
  lockup for the header.
- A /kitchen-sink route rendering every component in every state.

Constraints:
- No component library. No new dependencies beyond those listed in doc 02 §1.
- Every color, radius, shadow, and duration comes from a token. No hardcoded hex
  anywhere outside globals.css.
```

---

## Phase 1 — Local data layer

```
Read docs/03-database.md (Local mirror section) and docs/06-data-contracts.md in full.

Build the local data layer. No Supabase yet — Dexie only.

- src/lib/db/types.ts: every type from doc 06 §1, exactly as written
- src/lib/db/schema.ts: Dexie 4 database, version 1, tables and indexes from doc 03
- src/lib/db/repo.ts: implement the full Repo interface from doc 06 §3 against Dexie.
  Mutations wrap the row write and the outbox enqueue in one transaction, even
  though the sync engine doesn't exist yet — the outbox table gets written from
  day one so phase 8 has nothing to retrofit.
- src/lib/db/validators.ts: Zod schemas from doc 06 §5
- src/lib/db/seed.ts: default settings, 8 task templates, the 22-badge catalog
- A dev-only /dev/seed route generating 90 days of plausible sessions and 15 tasks
  with a realistic distribution — some zero days, a couple of heavy days
- Expose window.__repo in development for console testing

Rules:
- IDs are crypto.randomUUID(), generated client-side
- Soft delete everywhere. Every query filters deletedAt == null
- camelCase in TS, and keep the snake_case mapping in one file for later
- Read paths that feed live lists expose Dexie query builders for useLiveQuery;
  async repo methods are for mutations and computed reads
```

---

## Phase 2 — Timer engine

```
Read docs/02-architecture.md §3 and docs/06-data-contracts.md §2 in full.
This is the most important phase in the project. Write the tests first.

1. src/lib/timer/machine.ts — a pure reducer. No React, no Dexie, no Date.now()
   inside; `now` is always passed in. Types and signatures exactly as doc 06 §2.

2. src/lib/timer/machine.test.ts — Vitest. Cover all seven invariants listed in
   doc 06 §2 before writing any UI. Include:
   - completing at now > endsAt records endedAt = endsAt, not now
   - pause for N ms then resume shifts endsAt by exactly N
   - skip mid-focus records interrupted with the real elapsed time

3. src/lib/timer/store.ts — Zustand store wrapping the machine. Persists
   TimerRuntime to the Dexie meta table on every transition and rehydrates on
   mount. Expose a remainingMs selector so only the digits subscribe to ticks.

4. src/workers/ticker.ts — Web Worker posting a bare "tick" every 250ms. It holds
   no state. Plus recompute on visibilitychange, window focus, and pageshow.

5. A setTimeout alarm scheduled at endsAt, rescheduled on pause and resume, so
   completion fires even without a tick.

6. src/lib/timer/audio.ts — AudioContext unlocked inside the first Start click
   (play a silent buffer to satisfy iOS), 5 chime options, volume control, and
   re-resume on visibilitychange.

7. Notification wrapper handling default / granted / denied. Never request
   permission on load.

8. On every phase end, record a Session via repo.recordSession with the correct
   localDate for the user's timezone.

Verify before finishing: start a 25-minute timer, background the tab 10 minutes,
return, and confirm drift is under 1 second. Then reload mid-session and confirm
it resumes exactly.
```

---

## Phase 3 — Focus Timer screen

```
Read docs/05-screens.md S1 and docs/04-design-system.md §5 in full.

Build the Focus Timer screen at /.

- ProgressRing: SVG, 280px mobile / 320px desktop, 10px strokes, round cap,
  rotated -90°. Drive stroke-dashoffset from a single requestAnimationFrame loop,
  NOT React state. No glow, no shadow on the ring.
- Center stack: phase eyebrow (condensed uppercase, accent), countdown in Archivo
  with tabular-nums, attached task title below — or a ghost "Attach a task" button.
- Controls: Reset and Skip as 44px ghost buttons, Play/Pause as a 64px accent FAB.
  Press states with the snappy spring. Haptics per doc 04 §4. Reset confirms only
  if more than 60 seconds have elapsed.
- Phase change: cross-fade --accent on <html> over 480ms by swapping data-phase.
- Mode segmented control (Flip / Timer); Flip routes to /focus and persists.
- Streak card: current streak, 7-dot week row, today's session count and total time.
- Today's tasks: up to 3 rows from today's plan, tap to attach, "Plan" link to /plan.
- Loading: render the ring track immediately with a 3-char skeleton for the digits.
  Never render a placeholder number that then changes.
- Empty state copy exactly as written in doc 05 S1.

Performance requirement: during a running session, the only component that
re-renders each second is the digit block. Verify with the React DevTools profiler
before you call this done.
```

---

## Phase 4 — Tasks, Create sheet, Task details

```
Read docs/05-screens.md S4, S5 and S6, and docs/06-data-contracts.md in full.

Build the three task screens.

/tasks:
- Segmented Active / Completed with counts; sort menu (Recent, Priority, Due, A–Z)
- Horizontal tag chip filter, multi-select, accent-muted when selected
- TaskCard: 4px colored left rail, 36px squircle icon tile, title, subtask progress
  bar with done/total, estimate chip, recurring badge, complete button.
  Swipe left on touch reveals Complete and Delete; hover reveals the same on pointer.
- Free-tier meter appears at 7+ active tasks; at 10 the add button opens the upsell
  sheet instead of the create sheet
- Upsell sheet: headline, five Pro features as a plain list, email field, one button
  "Notify me at launch" writing to the waitlist table. No fake checkout.
- Virtualize with @tanstack/react-virtual above 100 rows

Create/edit sheet (same component, snap points 60% / 95%):
- Templates strip (8 templates) pre-filling title, icon, color, priority, estimate
- Title, icon picker, color picker (8 muted colors), notes, priority segmented,
  estimate stepper, recurring toggle with weekday selector, tag input
- Autofocus the title on desktop only, never on mobile
- Save disabled until the title is non-empty; recurring requires ≥1 weekday
- Dirty-state confirm on dismiss

/tasks/[id]:
- Header actions: export, edit, delete (confirm, soft delete, Undo toast 6s)
- Task card with priority flag, tags, description, pomodoro count,
  "Start focus session" primary button that attaches and routes to /
- Subtask rows: checkbox, inline-editable title, priority badge, updated date,
  long-press reorder, swipe to delete
- When the last subtask is checked, show a toast offering to complete the parent.
  Never auto-complete silently.
- Session history for the task, newest first, 10 with a Show all expander

Do NOT build an AI-generate button. It is out of scope for v1.
```

---

## Phase 5 — Daily Planner

```
Read docs/05-screens.md S2 in full.

Build /plan.

- Header: close, date (tap for a ±7 day picker), Auto-plan accent pill
- Summary card: "N tasks planned · X of N done" with an animated progress bar
- Three block sections — Morning / Afternoon / Evening — with time-of-day icons,
  condensed eyebrows, plain-language ranges, count badges, and header tints from
  the Daylight palette in doc 04 §1
- Rows: checkbox, priority dot, title, one-line description, drag handle
- Drag to reorder within and across blocks using @dnd-kit/core, touch-friendly,
  persisting plannedBlock and plannedOrder
- Per-block "Add task" ghost row opening the create sheet with plannedBlock pre-set

src/lib/planner/autoplan.ts — implement the algorithm in doc 05 S2 exactly,
including the manual-override rule: tasks with plannedManually = true are never
moved, and Auto-plan only fills around them. Any manual drag sets that flag.
Overflow tasks stay unplanned and are reported in the return value.

Unit test autoplan:
- running it twice in a row is idempotent
- manually placed tasks never move
- high-priority tasks land in the morning while capacity remains
- overflow count is correct when capacity is exceeded

Show an Undo toast for 6 seconds after every Auto-plan run.
```

---

## Phase 6 — Reports and Personal Bests

```
Read docs/05-screens.md S7 and S8, docs/03-database.md (streak definition), and
docs/06-data-contracts.md §4 in full.

1. src/lib/stats/aggregate.ts — all computed locally from Dexie:
   - getHeatmap(weeks): relative intensity buckets per doc 06 §4. Buckets are
     relative to the user's own p90 daily count, floored at 4 — not a fixed scale.
   - getStreaks(): exactly the definition in doc 03. A streak ending yesterday
     still counts as current.
   - getPersonalBests(range): best day / week / month, current period vs best,
     top-20 rankings by FOCUS TIME not session count
   - Break sessions are excluded from every stat

2. Unit tests including a session started at 23:50 local time and one during a DST
   transition. Confirm both land on the correct localDate.

3. src/lib/stats/achievements.ts — the 22-badge catalog from doc 05 S7, evaluated
   after every completed session, returning newly unlocked keys.

4. /reports:
   - Achievements card with a circular progress ring, opening a full grid. Locked
     badges show their name and requirement — nothing hidden.
   - Heatmap: 12 weeks × 7 days, hand-rolled SVG, 12px cells / 3px gaps / 3px radius,
     5 opacity steps of --accent, Less→More legend, 8ms stagger on mount only.
     Tapping a cell opens a day sheet with that day's sessions.
   - Weekly / Monthly range toggle
   - Monthly bar chart, 6 months, hand-rolled SVG
   - Empty state renders the empty grid, never hides it

5. /records (named "Personal bests", not Leaderboard):
   - Day / Week / Month segmented control re-ranking everything below
   - Hero card: --accent at 12% over --surface-raised, not a saturated slab
   - This-period card with percentage of best and a progress bar; "New best" when
     the current period leads
   - Top-20 rankings, medals for the top three, current period highlighted

No chart library. Both charts are hand-rolled SVG.
```

---

## Phase 7 — Flip Clock and Settings

```
Read docs/05-screens.md S3 and S9, and docs/04-design-system.md §5 in full.

/focus — full screen, no tab bar, no header:
- FlipDigit component: two stacked halves, perspective 800px, top half rotateX
  0→-90° while the incoming bottom half goes 90°→0°, 380ms, with a linear-gradient
  overlay darkening through the mid-flip. A 1px hairline seam splits each card.
- Only digits that actually change animate.
- Four cards as MM:SS, sized clamp(72px, 22vw, 180px)
- Two accent separator dots pulsing at 0.5Hz with a 2s ease
- Vertical FOCUS rail down the right edge in condensed eyebrow type
- Control rail (reset, play/pause, skip, mute, exit) fading out after 3s of no
  pointer movement, restored by any tap or key
- Wake Lock requested on entry, released on exit, silently skipped if unsupported
- Landscape reflow to a single row. Do not lock orientation.
- Esc exits to /. Timer state is shared — the two screens are one machine.
- prefers-reduced-motion: digits swap instantly with no layout shift

/settings — grouped inset list, iOS style, groups and rows exactly as doc 05 S9.
- Duration rows open a wheel-style picker sheet, not a number input
- Every change persists immediately. No Save button.
- Sound rows preview on tap
- Data group: export JSON, import JSON (additive and idempotent, upsert by ID,
  newer updatedAt wins), delete all data behind a typed DELETE confirmation
```

---

## Phase 8 — Auth and sync

```
Read docs/02-architecture.md §5, docs/03-database.md, and docs/08-deployment.md in full.

1. Supabase migrations 001–006 from doc 03, in supabase/migrations/ with
   timestamped filenames. Do not modify the SQL — it is the spec.

2. src/lib/supabase/client.ts (browser) and server.ts (auth callback only).
   Never reference the service_role key anywhere.

3. Anonymous sign-in on first load if there is no session. Magic-link upgrade flow
   plus /auth/callback. Linking an email to an anonymous user must preserve the
   UID so existing rows carry over untouched — verify this by hand.

4. src/lib/sync/mappers.ts — the single camelCase ↔ snake_case boundary.

5. src/lib/sync/outbox.ts and engine.ts:
   - Push: drain oldest-first, batched by table, Supabase upsert, delete on success
   - Backoff: 1s, 2s, 4s … capped at 5 min; park after 10 attempts
   - Pull: rows where updated_at > lastPulledAt, per table, tracked in the meta table
   - Triggers: sign-in, reconnect, every 5 min while visible
   - Conflicts: last-write-wins on updatedAt, except local wins when a pending
     outbox entry exists for that row
   - Soft deletes sync as ordinary updates

6. Sync-state indicator: a 3px hairline bar under the header while syncing.
   Parked entries show one quiet, non-blocking indicator. No error dialogs.

Verify before finishing:
- Two browsers on the same account converge within 5 minutes
- Airplane mode: 3 tasks + 2 sessions, reconnect, everything syncs with no duplicates
- Anonymous → email keeps all data
- In the SQL editor as user B: select count(*) from tasks where user_id != auth.uid()
  returns 0
```

---

## Phase 9 — PWA, polish, launch

```
Read docs/08-deployment.md §5 and docs/04-design-system.md §7 in full.

1. Serwist service worker: precache the shell, fonts, icons, and chimes.
   Network-first for navigation with the cached shell as the offline fallback.
   Never cache /api/* or anything on supabase.co.

2. manifest.ts per doc 08 §5, icons at 192/512/maskable, apple-touch-icon,
   apple-mobile-web-app-* meta, safe-area insets on the tab bar and every sheet.

3. Onboarding overlay (doc 05 S10), three cards, gated on profiles.onboarded_at.
   Card 3 shows iOS Add-to-Home-Screen instructions when not in standalone mode,
   and a real Install button wired to beforeinstallprompt on Chromium.

4. Notification permission requested only after the first completed session, in
   context, never on load.

5. Accessibility pass against doc 04 §7: visible focus rings everywhere, 44px
   targets, aria-live on phase changes with the countdown aria-hidden, contrast
   verified, and the full keyboard path (Space, S, F, N, Esc).

6. Empty states for every list, copy from doc 05.

7. Error boundary on every route.

8. Playwright E2E: create a task → start a session → background the page →
   return → session completes and is recorded with the correct duration.

9. Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, PWA installable.
   Fix what fails; report anything you cannot fix rather than lowering the bar.
```

---

## Prompts for when things go wrong

```
The timer drifts when the tab is backgrounded. Re-read docs/02-architecture.md §3
and confirm the implementation derives remaining time from endsAt on every tick
and never decrements a counter. Show me the tick path.
```

```
This component hardcodes colors. Every color must come from a token in
docs/04-design-system.md §1. Find every hardcoded hex outside globals.css and
replace it.
```

```
You added a dependency that isn't in docs/02-architecture.md §1. Remove it and
solve this with what's already in the project, or tell me why the doc is wrong.
```

```
This screen doesn't match docs/05-screens.md S<N>. List every difference between
the spec and what you built, then fix them.
```

```
Something in the last change broke the timer tests. Do not modify the tests —
they encode the invariants in docs/06-data-contracts.md §2. Fix the implementation.
```
