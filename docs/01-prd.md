# 01 — Product Requirements

## 1. One-liner

A calm, premium focus timer that turns a flat to-do list into a finished day — Pomodoro sessions, a time-blocked planner, and honest stats about your own progress. Works offline, installs like an app, costs nothing to try.

## 2. Problem

Existing Pomodoro apps split into two bad piles:

- **Toy timers** — pretty countdown, no task context, no memory. Users treat them like a stopwatch and abandon them in a week.
- **$20/mo productivity suites** — heavy, cluttered, subscription-gated, and iOS-only so there's no desktop-to-phone continuity.

The gap: a *task-anchored* timer that is calm to look at, remembers what you did, and runs everywhere a browser runs.

## 3. Target user

**Primary — "The Focused Maker"**
Solo developer, designer, writer, or student, 20–40. Works in long blocks at a desk, moves to a phone or tablet between sessions. Already tried 2–3 timer apps. Cares about aesthetics; will not use something ugly. Willing to pay $3–6/mo *once* the app has proven itself over ~2 weeks.

**Secondary — "The Overwhelmed Planner"**
Has 40 open tasks and no sense of which fit into today. Needs the planner more than the timer, but the timer is what makes the plan real.

**Not the target:** teams, agencies, time-tracking-for-invoicing, anyone who needs integrations with Jira/Asana.

## 4. Value proposition

> Every session you run is attached to a real task, and every task rolls up into a picture of your week that you actually want to look at.

Three pillars:

1. **Anchored** — the timer always knows what you're working on.
2. **Honest** — stats compare you to your own past, never to strangers.
3. **Calm** — the interface never shouts. No streak-loss guilt animations, no red alarms, no gamified confetti spam.

## 5. Scope

### v1.0 — must ship

| Area | Requirement |
|------|-------------|
| **Timer** | Focus / short break / long break phases with configurable durations. Timestamp-accurate — survives tab backgrounding, sleep, and reload. Start / pause / skip / reset. |
| **Timer modes** | Ring mode (animated SVG progress ring) and Flip Clock mode (full-screen split-flap). Toggle persists. |
| **Task link** | A session can be attached to a task. Completed focus sessions increment that task's pomodoro count. |
| **Tasks** | Create, edit, complete, archive, soft-delete. Title, notes, icon, color, priority, category, tags, estimated pomodoros. |
| **Subtasks** | Ordered checklist per task, each with own priority and done state. Reorderable. |
| **Planner** | Today view bucketed into Morning / Afternoon / Evening. One-tap **Auto-plan** distributes unplanned tasks across buckets by priority + estimate. Drag to reorder inside a bucket. |
| **Reports** | 12-week activity heatmap, monthly session bar chart, achievements grid. All computed from local data. |
| **Personal bests** | Best day / best week / best month, current + longest streak, all-time weekly rankings. No social leaderboard. |
| **Settings** | Durations, auto-start toggles, sound + volume, notifications, theme (system/light/dark), default timer mode. |
| **Auth** | No account required, ever. The app is fully usable signed out; an optional email magic link turns on cross-device sync. No passwords, no anonymous accounts. |
| **Offline** | Full functionality with no network. Sync resumes automatically. |
| **PWA** | Installable, offline shell, app icon, splash, standalone display. |
| **Notifications** | Local notification + sound when a phase ends. Works when the tab is backgrounded. |

### v1.1 — fast follow

- Recurring tasks (weekday selector, auto-regenerate).
- Task templates strip on the create sheet (Meeting, Email, Coding, Code Review, Deep Work…).
- CSV / JSON export.
- Keyboard shortcuts + command palette (desktop).
- Wake Lock during focus so the screen stays on.

### v2 — only if v1 gets traction

- AI subtask generation (needs a paid LLM key — see §8).
- Ambient soundscapes.
- Calendar (.ics) read-only overlay in the planner.
- Cross-device push notifications.

### Explicitly out of scope

- Teams, shared workspaces, or any social leaderboard.
- Third-party integrations (Jira, Notion, Todoist).
- Native iOS/Android builds. The PWA is the product.
- Time-tracking exports for billing.

## 6. Success criteria

Grouped so you know what "working" means at each stage.

**Product quality (pre-launch, self-tested)**
- Timer drift under 1 second across a 25-minute backgrounded session.
- First contentful paint under 1.5s on a mid-tier phone over 4G.
- Every screen usable one-handed at 390×844 (iPhone 14 baseline).
- Zero data loss across offline → online transition, tested by hand.

**Market signal (first 30 days after launch)**
- 100 first-run sessions.
- **Day-7 retention above 20%** — the single number that decides whether to continue.
- 10 unprompted qualitative responses (email, DM, or in-app feedback).
- 5% of active users click the "Pro — notify me" button.

If day-7 retention lands under 10%, the concept is wrong, not the polish. See [10-validation.md](10-validation.md).

## 7. Monetization posture for the market test

Do **not** build payments in v1. Build the *gate* and the *intent signal*:

- Free tier caps at **10 active tasks** — mirrors the reference app and is a real constraint for the secondary persona.
- Hitting the cap opens an upsell sheet that states the count — "10 / 10 active tasks on the free plan" — a line on what Ajeg Plus would lift, a single **"Join the waitlist"** email capture, and **"Complete a task instead"** as the way back out. The ticked feature list it used to lead with read as a pricing page for something you cannot buy; issue #8.
- Emails land in a `waitlist` table. Conversion rate on that button is your willingness-to-pay proxy — at zero cost and zero Stripe integration.

Planned Pro feature set (state it in the sheet so the signal is honest): unlimited tasks, cross-device sync, custom themes, data export, AI subtask breakdown.

## 8. Known constraints and risks

| Risk | Mitigation |
|------|-----------|
| **Vercel Hobby forbids commercial use.** A waitlist is fine; the moment you charge money you must move to Pro ($20/mo). | Stay on Hobby through validation. Budget the upgrade only after retention clears the bar. |
| **Supabase free projects pause after 7 days of no activity.** | Keep-alive cron. See [08-deployment.md](08-deployment.md) §4. |
| **Browser notifications are unreliable when the tab is fully closed** (especially iOS Safari, which requires the PWA be installed to the Home Screen). | Web Worker timer + in-tab audio as the primary alert. Notification is an enhancement, never the only signal. Onboarding nudges iOS users to "Add to Home Screen". |
| **iOS Safari suspends audio without a user gesture.** | Unlock the `AudioContext` on the first Start tap and keep it warm for the session. |
| **AI subtask generation costs money per call** and cannot be free-tier. | Cut from v1 entirely. The button in the reference screenshots is not shipping. |
| Local-first sync conflicts across two devices. | Last-write-wins on `updated_at`, per-row. Documented in [02-architecture.md](02-architecture.md) §5. Acceptable for a single-user app. |

## 9. Design direction

The reference app is high-contrast pure black with alarm-red accents — it reads urgent and gamified. **You want the opposite.** See [04-design-system.md](04-design-system.md) for the full system. The short version:

- Warm neutral surfaces, not pure black and not pure white.
- One muted sage accent for focus; warm clay for breaks. No alarm red anywhere except destructive actions.
- Generous whitespace, large soft radii, layered low-opacity shadows.
- iOS-native spring motion. Nothing linear, nothing bouncy-cartoonish.
- Typography does the work: tabular numerals, tight tracking, real hierarchy.
