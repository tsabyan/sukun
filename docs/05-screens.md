# 05 — Screen Specs

Ten screens. Each spec lists route, layout, elements, states, and interactions. Wireframes are mobile (390px); desktop adaptation is noted per screen.

**Global shell**

- **Mobile:** bottom tab bar, translucent material, 4 tabs — Timer, Plan, Tasks, Report. 56px + safe-area inset. `/focus` and sheets hide it.
- **Desktop (≥1024px):** left rail 240px, same 4 destinations plus Settings and Records at the bottom. Content column max-width 720px, centered.
- **Daylight layer** sits behind everything at `z-index: 0`.
- **Offline / sync state:** a 3px hairline bar under the header, `--text-tertiary` when syncing, hidden otherwise. No banners, no toasts for normal sync.

---

## S1 — Focus Timer · `/`

The screen users open ten times a day. It must be instant and it must be quiet.

```
┌──────────────────────────────────┐
│  Sukun ْ                    ⚙︎   │
│                                  │
│    ┌──────────┐  ┌──────────┐    │
│    │ Flip     │  │ ● Timer  │    │  segmented, layoutId thumb
│    └──────────┘  └──────────┘    │
│                                  │
│         ╭────────────╮           │
│       ╭─╯            ╰─╮         │
│      │   FOCUS · 3/4    │        │  eyebrow, accent
│      │                  │        │
│      │     24:13        │        │  display-l, tabular
│      │                  │        │
│      │  Update API docs │        │  attached task, body-sm
│       ╰─╮            ╭─╯         │
│         ╰────────────╯           │
│                                  │
│    ( ⟲ )   ( ⏭ )      ( ▶ )      │  reset, skip, primary FAB
│                                  │
│  ┌────────────────────────────┐  │
│  │ ◐ 6 day streak      · · ·  │  │  streak card, week dots
│  │ 3/5 sessions · 1h 15m      │  │
│  └────────────────────────────┘  │
│                                  │
│  Today's tasks              Plan │
│  ┌────────────────────────────┐  │
│  │ ▪ Update API docs      ⏱ 2 │  │  tap = attach to timer
│  │ ▪ Review pull requests ⏱ 1 │  │
│  └────────────────────────────┘  │
│  [ Timer ] [ Plan ] [ Tasks ] [ Report ]
└──────────────────────────────────┘
```

**Elements**

1. **Header** — app name (title-l), settings icon button. No back button; this is home.
2. **Mode toggle** — segmented control, Flip / Timer. Choosing Flip routes to `/focus`. Persists to settings.
3. **Ring** — 280px diameter mobile, 320px desktop. Spec in [04](04-design-system.md) §5. Center stack: eyebrow `FOCUS · 3 OF 4` in accent, countdown, attached task title (or a ghost button reading "Attach a task").
4. **Controls** — Reset (ghost, 44px) · Skip (ghost, 44px) · Play/Pause (primary FAB, 64px, accent fill). Reset asks for confirmation only if more than 60 seconds have elapsed.
5. **Streak card** — current streak with a 7-dot week row (filled = a completed focus session that day), today's session count and total focused time. Tapping it opens `/reports`.
6. **Today's tasks** — up to 3 rows from today's plan, with a "Plan" link to `/plan`. Tapping a row attaches that task to the timer and moves it to the ring's center label.

**States**

| State | Behaviour |
|-------|-----------|
| Idle | Countdown shows the full phase duration. FAB = Play. Reset/Skip disabled. |
| Running | FAB = Pause. Ring depletes. Digits update at 1Hz. |
| Paused | Digits at 50% opacity, ring holds. FAB = Play. A `Paused` eyebrow replaces the phase label. |
| Complete | Chime + haptic + notification. Accent cross-fades to the next phase over 480ms. Auto-advances if the matching auto-start setting is on, otherwise sits idle on the next phase. |
| First run | Ring shows `25:00`, task strip shows an empty state: "No tasks yet. Add one to give this session a purpose." with an Add task button. |
| Loading | Ring track renders immediately; digits show a 3-character skeleton until IndexedDB resolves. Never render a wrong number. |

**Desktop** — ring and controls left, streak + today's tasks in a right column at ≥1024px.

---

## S2 — Daily Planner · `/plan`

Turns a flat list into a shaped day.

```
┌──────────────────────────────────┐
│  ✕   Sat, Aug 2      ⚡︎ Auto-plan │
│                                  │
│  8 tasks planned         0 of 8  │
│  ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                  │
│  ☀ MORNING · before noon      3  │
│  ┌────────────────────────────┐  │
│  │ ☐ ▪ Complete Q1 proposal ⋮⋮│  │
│  │   Draft and submit          │  │
│  ├────────────────────────────┤  │
│  │ ☐ ▪ Update API docs      ⋮⋮│  │
│  └────────────────────────────┘  │
│  ＋ Add task                      │
│                                  │
│  ◐ AFTERNOON · noon–5pm       3  │
│  ...                             │
│  ☾ EVENING · after 5pm        2  │
└──────────────────────────────────┘
```

**Elements**

1. **Header** — close (returns to `/`), date (tap = date picker, ±7 days), **Auto-plan** button (accent pill, lightning icon).
2. **Summary card** — "N tasks planned · X of N done" with a progress bar animated on change.
3. **Three block sections** — each with a time-of-day icon, condensed eyebrow, plain-language range, and a count badge. The header tint comes from the Daylight palette so Morning/Afternoon/Evening are visually distinct without color-coding.
4. **Rows** — checkbox, priority dot, title, one-line description, drag handle. Long-press (or handle drag) reorders within and across blocks.
5. **Add task** — ghost row per block; opens the create sheet with `planned_block` pre-filled.

**Auto-plan algorithm** (`lib/planner/autoplan.ts`)

```
inputs:  unplanned active tasks for the selected date
         capacity per block, derived from focus_minutes:
           morning 4 pomodoros, afternoon 4, evening 2
sort:    priority desc, then estimated_pomodoros desc, then created_at asc
place:   high priority → morning first, then afternoon
         medium        → afternoon, then morning, then evening
         low           → evening, then any block with room
overflow: tasks that don't fit stay unplanned; show
          "3 tasks didn't fit today" with a link to /tasks
```

**Auto-plan never moves a task the user placed by hand.** Manual placement sets `planned_manually = true` locally; Auto-plan only fills around those. This is the answer to the open question in the reference post — respecting manual overrides is what makes the button safe to press twice.

Pressing Auto-plan a second time in the same session offers **Undo** in a toast for 6 seconds.

**Empty state** — "Nothing planned yet. Auto-plan will spread your open tasks across the day." with the Auto-plan button as the primary action.

---

## S3 — Flip Clock · `/focus`

Full-screen, no chrome, no tab bar. This is the view people screenshot.

```
┌──────────────────────────────────┐
│                                  │
│   ┌────────┐  ┌────────┐         │
│   │   2    │  │   4    │      F  │
│   ├────────┤  ├────────┤      O  │
│   │        │  │        │      C  │
│   └────────┘  └────────┘      U  │
│        ·  ·                   S  │
│   ┌────────┐  ┌────────┐         │
│   │   1    │  │   3    │         │
│   ├────────┤  ├────────┤         │
│   └────────┘  └────────┘         │
│                                  │
│  ⟲    ⏸    ⏭            🔇   ✕  │  fades out after 3s
└──────────────────────────────────┘
```

**Elements**

1. **Four digit cards** — MM:SS, split-flap animated per digit (only digits that change animate). Cards use `--surface-raised` on a `--canvas` field; the mid-card hairline seam is the detail that sells the physicality.
2. **Separator** — two accent dots between the pairs, pulsing at 0.5Hz with a 2s ease so it reads as a heartbeat rather than a blink.
3. **Vertical FOCUS rail** — the phase name set vertically down the right edge in condensed eyebrow type, `--text-tertiary`.
4. **Control rail** — reset, play/pause, skip, mute, exit. Fades to 0 opacity after 3s of no pointer movement; any tap or key restores it.
5. **Wake Lock** — requested on entry, released on exit. Silently ignored if unsupported.

**Orientation:** portrait-first, but the layout is a flex row that reflows to a single line of four cards in landscape. Do not lock orientation — a browser tab can't reliably do it, and a landscape flip clock on a propped-up phone is the best version of this screen.

**Exit:** ✕ or `Esc` returns to `/`. Timer state is untouched — the two screens are two views of the same machine.

---

## S4 — Task Manager · `/tasks`

```
┌──────────────────────────────────┐
│  Tasks                    ＋  ⚙︎  │
│  ┌──────────┬──────────┐         │
│  │ Active 8 │Completed │  ↕ Recent│
│  └──────────┴──────────┘         │
│  ⟨ bug · code-review · docs ⟩    │  horizontal tag chips
│                                  │
│  8 of 10 tasks            ✦ Pro  │  free-tier meter
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░  2 left    │
│                                  │
│  ┌─┬──────────────────────────┐  │
│  │▪│ ▣ Complete Q1 proposal ✓ │  │  colored left rail
│  │ │ ▓▓▓▓░░ 2/3 · ⏱ 2 · ↻     │  │
│  └─┴──────────────────────────┘  │
│  ...                             │
└──────────────────────────────────┘
```

**Elements**

1. **Header** — title, add button (opens create sheet), settings.
2. **Segmented control** — Active / Completed, with counts. Sort menu on the right: Recent, Priority, Due date, A–Z.
3. **Tag chips** — horizontal scroll, multi-select filter. Selected chips fill with `--accent-muted`.
4. **Free-tier meter** — visible only when `active tasks ≥ 7`. Shows "N of 10 tasks" with a progress bar and a Pro badge. At 10, the add button opens the upsell sheet instead of the create sheet.
5. **Task card** — 4px colored left rail (task color), squircle icon tile, title, subtask progress bar with `done/total`, estimate chip, recurring badge, and a right-side complete button. Swipe left: Complete · Delete.

**Upsell sheet** — headline "You've hit the free limit", the five Pro features as a plain list, an email field, and one button: **Notify me at launch**. On submit: insert into `waitlist`, replace the sheet body with "We'll email you when Pro is ready." No paywall, no card field, no fake checkout.

**Empty states** — Active: "No open tasks. Add one, or check what you finished." Completed: "Nothing completed yet."

**Virtualization** — `@tanstack/react-virtual` above 100 rows.

---

## S5 — Create / Edit Task · sheet over `/tasks`

Bottom sheet, snap points `['60%', '95%']`. Same component for create and edit; edit pre-fills and the primary button reads Save changes.

```
┌──────────────────────────────────┐
│  ────                            │  grabber
│  ✕      New task           Save  │
│                                  │
│  TEMPLATES                       │
│  ⟨ Meeting · Email · Coding …⟩   │
│                                  │
│  TITLE                           │
│  ┌────────────────────────────┐  │
│  │ What do you want to do?    │  │
│  └────────────────────────────┘  │
│                                  │
│  APPEARANCE                      │
│  ┌────────┐  ┌────────┐          │
│  │ ▣ Icon │  │ ● Color│          │
│  └────────┘  └────────┘          │
│                                  │
│  NOTES         (optional)        │
│  PRIORITY   [High][Med][Low]     │
│  ESTIMATE   [− 2 +] pomodoros    │
│  REPEATS    ○──                  │
│  TAGS       [ Add a tag…    + ]  │
└──────────────────────────────────┘
```

- **Templates** — horizontal strip, pre-fills title, icon, color, priority, estimate. Ships with: Meeting, Email, Coding, Code review, Deep work, Reading, Admin, Exercise.
- **Autofocus:** yes on desktop, **no on mobile**. An auto-raised iOS keyboard covers the sheet before the user has seen it. Focus on first tap instead.
- **Save** is disabled until the title is non-empty. If the recurring toggle is on, at least one weekday must be selected.
- **Recurring** — toggle reveals a 7-day selector (S M T W T F S). Stored as `recurrence: { freq: 'weekly', days: number[] }`.
- **Dismiss** — drag below 40%, tap the backdrop, or `Esc`. If any field is dirty, confirm: "Discard this task?" / Discard · Keep editing.

---

## S6 — Task Details · `/tasks/[id]`

```
┌──────────────────────────────────┐
│  ‹      Task details    ⇪  ✎  🗑 │
│  ┌────────────────────────────┐  │
│  │ ▣  Complete Q1 proposal    │  │
│  │ ⚑ High · work · urgent     │  │
│  │ Draft and submit the Q1…   │  │
│  │ ⏱ 2 of 3 pomodoros         │  │
│  │ ▶ Start focus session      │  │  primary
│  └────────────────────────────┘  │
│                                  │
│  Subtasks  1/4          ＋ Add   │
│  ┌────────────────────────────┐  │
│  │ ☐ Research requirements HIGH│  │
│  │   Updated Aug 1             │  │
│  ├────────────────────────────┤  │
│  │ ☑ Create initial draft  MED │  │
│  └────────────────────────────┘  │
│                                  │
│  Sessions on this task           │
│  Aug 2 · 25m · completed         │
└──────────────────────────────────┘
```

- **Header actions** — export (JSON to clipboard), edit (opens S5 sheet), delete (confirm → soft delete → back to `/tasks` with a 6s Undo toast).
- **Start focus session** attaches the task and routes to `/`, timer running.
- **Subtask row** — checkbox, title (inline-editable on tap), priority badge, updated date. Long-press reorders. Swipe left deletes.
- **Auto-complete parent:** when the last subtask is checked, show a toast — "All subtasks done. Mark task complete?" with a Complete action. Never auto-complete silently; a checklist finishing is not the same as work being finished, and silent state changes erode trust.
- **Session history** — every session logged against this task, newest first, capped at 10 with a "Show all" expander.
- **No AI generate button in v1.** See [01-prd.md](01-prd.md) §8.

---

## S7 — Reports & Streaks · `/reports`

```
┌──────────────────────────────────┐
│  Report                    ✦  ⚙︎ │
│                                  │
│  ┌────────────────────────────┐  │
│  │ ◜◝  Achievements        ›  │  │
│  │ ◟◞  8 of 22 unlocked       │  │
│  └────────────────────────────┘  │
│                                  │
│  ACTIVITY            [Monthly ▾] │
│  ┌────────────────────────────┐  │
│  │ Mon ▪▪▫▪▪▫▪▪▪▫▪▪…          │  │
│  │ Wed ▪▫▪▪▪▪▫▪▫▪▪▪…          │  │
│  │ Fri ▫▪▪▪▪▫▪▪▪▪▫▪…          │  │
│  │  Less ▫▪▪▪▪ More           │  │
│  └────────────────────────────┘  │
│                                  │
│  Monthly activity      153 sess. │
│  ┃ ┃ ┃ ┃ ┃ ┃                     │
│  Mar Apr May Jun Jul Aug         │
└──────────────────────────────────┘
```

- **Achievements card** — circular progress ring, "8 of 22 unlocked", opens a full grid. Locked badges show name + requirement in `--text-tertiary`; nothing is hidden, because a mystery badge you can't work toward is noise.
- **Heatmap** — 12 weeks × 7 days, column per week, five intensity steps of `--accent`. Weekly/Monthly toggle changes the range. Tapping a cell opens a day sheet with that day's sessions and total.
- **Monthly bar chart** — 6 months of session counts, hand-rolled SVG, bars in `--accent` at 85% with the current month at 100%.
- All figures computed locally in `lib/stats/aggregate.ts`. Aggregation over a year of data runs in under 20ms — no worker needed, but keep it out of render (`useMemo` keyed on the session count).
- **Empty state** — heatmap renders the empty grid with "Your first session will show up here." Never hide the chart; the shape of the thing is the motivation.

### Achievement catalog (22)

| Group | Badges |
|-------|--------|
| First steps | First session · First task done · First full day · First week |
| Volume | 10 · 50 · 100 · 250 · 500 · 1000 sessions |
| Streaks | 3 · 7 · 14 · 30 · 100 day streaks |
| Depth | 4 sessions in one day · 8 in one day · 3 hours in a day · 10 hours in a week |
| Habit | Every day of one week · One month, no gaps · 100 tasks completed |

Evaluated after every completed session. Unlock shows a single quiet toast — badge icon, name, one line. No modal, no confetti.

---

## S8 — Personal Bests · `/records`

Renamed from "Leaderboard". You are the only competitor, and calling it a leaderboard when there's nobody else on it is dishonest.

```
┌──────────────────────────────────┐
│  🏆 Personal bests            ✕  │
│  [ Day ][ Week ][ Month ]        │
│                                  │
│  ┌────────────────────────────┐  │
│  │ BEST WEEK                  │  │  accent gradient card
│  │ 15h 25m                    │  │
│  │ 3h 45m    15h 25m   55h    │  │
│  │ best day  best week  month │  │
│  │ ◐ 10 day streak            │  │
│  └────────────────────────────┘  │
│                                  │
│  THIS WEEK                       │
│  4h 35m              30% of best │
│  ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░       │
│                                  │
│  All-time weeks                  │
│  🥇 May 11–17   15h 25m  31 sess │
│  🥈 Jun 29–Jul 5 13h 20m 28 sess │
└──────────────────────────────────┘
```

- **Range control** — Day / Week / Month; every card below re-ranks.
- **Hero card** — the accent at 12% over `--surface-raised`, not a saturated gradient slab. Best figure for the selected range, three supporting stats, streak pill.
- **This period** — current total vs. the record, with a percentage and a progress bar. If the current period beats the record, the bar fills and the label reads "New best".
- **Rankings** — top 20 periods by focus time, medals for the top three, the current period highlighted with an accent rail wherever it lands.
- Ranked by **focus time**, not session count — a 50-minute session and two 25s are the same work, and ranking by count would reward chopping the day up.

---

## S9 — Settings · `/settings`

Grouped inset list, iOS style.

| Group | Rows |
|-------|------|
| **Timer** | Focus length · Short break · Long break · Sessions until long break · Auto-start breaks · Auto-start focus |
| **Sound & alerts** | Alert sound (5 options, tap to preview) · Volume · Notifications (requests permission) · Haptics |
| **Appearance** | Theme (System / Light / Dark) · Default timer mode (Ring / Flip) · Week starts on |
| **Account** | Signed-in state. Anonymous → "Save your data" with an email field. Signed in → email, Sync now, Sign out. |
| **Data** | Export JSON · Import JSON · Delete all data (type DELETE to confirm) |
| **About** | Version · What's new · Send feedback (mailto) · Privacy |

Duration rows open a wheel-style picker sheet, not a number input. Every change saves immediately — no Save button anywhere in settings.

---

## S10 — First run · overlay on `/`

Three cards, swipeable, skippable. Runs once, gated on `profiles.onboarded_at`.

1. **"Work in focused blocks."** — 25 minutes on, 5 off. Timer illustration.
2. **"Attach a session to real work."** — Task card illustration. CTA: **Add your first task** (opens S5) or Skip.
3. **"Install for the best experience."** — Shown only when not already in standalone mode. On iOS Safari: the Share → Add to Home Screen instructions with the actual icons, because notifications don't work otherwise. On Chromium: a single **Install** button wired to the captured `beforeinstallprompt` event.

Notification permission is **not** requested here. Ask after the user's first completed session, in context: "Want an alert when a session ends?" A cold permission prompt on first load gets denied, and a denied prompt is permanent.
