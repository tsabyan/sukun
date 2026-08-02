# 07 — Build Roadmap

Nine phases, strictly ordered. Each phase ends in something you can open in a browser. Don't start a phase until the previous one's done-criteria pass — with an AI coding agent, skipping the foundation phases is what produces a codebase you have to throw away in week two.

Estimates assume you're driving an agent, not typing by hand.

---

## Phase 0 — Foundation · ~2h

**Build**
- `create-next-app` with TypeScript, Tailwind v4, App Router, `src/` dir, `@/*` alias.
- Design tokens in `globals.css` — every variable from [04](04-design-system.md), both themes, all three phase accents.
- Fonts via `next/font/google`: Archivo Variable, Instrument Sans Variable.
- Theme provider + the blocking inline `<head>` script that sets `data-theme` before paint.
- Base UI kit: `Button`, `Card`, `Sheet`, `SegmentedControl`, `Toggle`, `Field`, `IconButton`, `Pill`.
- App shell: bottom tab bar (mobile) / left rail (desktop), Daylight layer.
- A `/kitchen-sink` route rendering every UI component in every state and both themes.

**Done when** `/kitchen-sink` looks right in light and dark, at 390px and 1440px, and theme switching produces no flash on reload.

> Build the kitchen sink. It's 30 minutes and it stops the agent from inventing a fourth button variant on screen six.

---

## Phase 1 — Local data layer · ~3h

**Build**
- Dexie schema from [03](03-database.md) §Local mirror.
- All types from [06](06-data-contracts.md).
- `repo.ts` implementing every method against Dexie only. No Supabase yet.
- Zod validators.
- Seed: default settings, 8 template definitions, the 22-badge catalog.
- A dev-only `/dev/seed` route that generates 90 days of plausible sessions and 15 tasks.

**Done when** you can create, read, update, and soft-delete a task from the browser console via `window.__repo`, and the seed route fills the DB.

---

## Phase 2 — Timer engine · ~4h

The most important phase. Everything else is CRUD.

**Build**
- `lib/timer/machine.ts` — pure reducer.
- **Vitest suite covering all seven invariants** in [06](06-data-contracts.md) §2. Write these before the UI.
- Zustand store wrapping the machine, persisting `TimerRuntime` to the Dexie `meta` table on every transition.
- `workers/ticker.ts` + the three recompute triggers (`visibilitychange`, `focus`, `pageshow`).
- `setTimeout` alarm at `endsAt`, rescheduled on pause/resume.
- `lib/timer/audio.ts` — AudioContext unlock on first Start, 5 chimes, volume control.
- Notification API wrapper with permission-state handling.
- Session recording on every phase end.

**Done when**
- All timer unit tests pass.
- Start a 25-minute timer, background the tab for 10 minutes, return → the countdown is correct within 1 second.
- Reload mid-session → the countdown resumes exactly where it was.
- Set focus to 1 minute, start it, lock the phone, wait → the alert fires and the session is recorded with the right duration.

---

## Phase 3 — Focus Timer screen (S1) · ~4h

**Build**
- Progress ring driven by `requestAnimationFrame`, not React state.
- Center stack, phase eyebrow, accent cross-fade on phase change.
- Controls with press states and haptics.
- Streak card with the 7-dot week row.
- Today's tasks strip with tap-to-attach.
- Loading skeleton for the pre-hydration frame.

**Done when** it holds 60fps during a running session (check DevTools Performance), and the only element re-rendering per second is the digit block.

---

## Phase 4 — Tasks + Create sheet (S4, S5, S6) · ~6h

**Build**
- Task list with segmented filter, sort menu, tag chips.
- Task card: color rail, icon tile, subtask progress, swipe actions.
- Create/edit bottom sheet with templates, icon picker, color picker, priority, estimate, recurrence, tags.
- Task details with inline-editable subtasks, reordering, session history.
- Free-tier meter + upsell sheet + `waitlist` insert.
- Virtualization above 100 rows.

**Done when** you can complete the full loop by hand: create a task from a template → open it → add three subtasks → reorder them → start a session from it → see the session in its history.

---

## Phase 5 — Planner (S2) · ~4h

**Build**
- Three block sections with Daylight-tinted headers and count badges.
- `lib/planner/autoplan.ts` + unit tests for the bucketing rules, including the manual-override rule.
- Drag to reorder within and across blocks (`@dnd-kit/core`, touch-friendly).
- Summary card with animated progress.
- Date picker, ±7 days.
- Undo toast after Auto-plan.

**Done when** Auto-plan run twice in a row produces the same result and leaves manually placed tasks exactly where they were.

---

## Phase 6 — Reports + Records (S7, S8) · ~5h

**Build**
- `lib/stats/aggregate.ts`: heatmap with relative intensity buckets, streaks, personal bests, rankings.
- Unit tests for streaks across timezone boundaries and DST — write the test with a session at 23:50 local and confirm it lands on the right day.
- Heatmap SVG with stagger-in and cell tap → day sheet.
- Monthly bar chart.
- Achievements ring, grid, and evaluation on session complete.
- Personal bests screen with range control and rankings.

**Done when** the seeded 90 days render a heatmap that matches a hand-counted spot check of three days, and streak numbers match the definition in [03](03-database.md).

---

## Phase 7 — Flip Clock + Settings (S3, S9) · ~4h

**Build**
- Split-flap digit component with `rotateX` and the mid-flip shadow.
- Full-screen layout, vertical FOCUS rail, auto-hiding control rail, Wake Lock.
- Landscape reflow.
- Settings screen, all groups, wheel pickers for durations, immediate persistence.
- Export / import / delete-all.

**Done when** the flip animation holds 60fps on a mid-tier phone and reduced-motion swaps digits instantly with no layout shift.

---

## Phase 8 — Auth + Sync · ~5h

**Build**
- Supabase project, migrations 001–006, RLS verified with two test users.
- Anonymous sign-in on first load.
- Magic-link upgrade flow + `/auth/callback`.
- `lib/sync/outbox.ts` and `engine.ts`: push, pull, backoff, last-write-wins.
- Sync-state hairline indicator.
- Online/offline listeners.

**Done when**
- Two browsers signed into the same account converge within 5 minutes.
- Airplane mode: create three tasks, complete two sessions, reconnect → everything appears remotely, nothing duplicated.
- Signing in from anonymous keeps all existing data.
- RLS test: user B cannot read user A's rows via the anon key. Verify this by hand in the SQL editor.

---

## Phase 9 — PWA, polish, launch · ~4h

**Build**
- Serwist service worker: precache the shell, network-first for the app, offline fallback.
- `manifest.ts`, icons (192/512/maskable), Apple touch icon, splash screens.
- Onboarding overlay (S10) + contextual notification prompt after the first completed session.
- Empty states for every list.
- Focus rings, `aria-live` on the timer, full keyboard path.
- Lighthouse: PWA installable, Accessibility ≥ 95, Performance ≥ 90 on mobile.
- Playwright E2E: full session lifecycle including backgrounding.
- Deploy per [08](08-deployment.md).

**Done when** it installs to an iPhone Home Screen, opens offline, runs a full session, and the session is there after reconnecting.

---

## Total: ~41 hours

Call it three focused weekends. The order matters more than the estimates.

## Rules for the whole build

1. **Never skip Phase 2's tests.** A Pomodoro app whose timer drifts is worthless, and drift is invisible until a user complains.
2. **One phase per session with the agent.** Clear context between phases so it re-reads the docs instead of drifting from memory.
3. **Commit at the end of every phase**, and tag it. When the agent breaks something in phase 6, you want a clean phase 5.
4. **No new dependencies without a line in [02](02-architecture.md) §1.** The agent will suggest a date library, a state library, and a chart library. The answers are already decided.
5. **Test on a real phone at the end of every phase**, not at the end. iOS Safari will surprise you, and it's cheaper to find out in phase 3.
