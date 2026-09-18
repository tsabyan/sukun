# 05 — Screen Specs

Sukun is a phone app that happens to run in a browser. There is one layout — a
single 440px column, centred at any window width — and every screen below is
specified at 390px. There is no desktop adaptation, because there is no desktop
version to adapt: the thumb zone is the whole argument for the bottom bar, and
a 1440px-wide version of it would be a different product.

## §0 — Global shell

- **Bottom bar** — a charcoal capsule 62px tall, floating inside the 16px
  gutter, 10px above the safe-area inset. Four tabs, two either side of a 56px
  gap: **Home `/` · Tasks `/tasks` — Habits `/habits` · Insights `/insights`**.
  The active tab is a white 50px circle behind the icon; the rest are the icon
  at 70% white. Labels are screen-reader only — four labels in a capsule this
  size wrap, and the icons carry the rest.
- **The one floating action** lives in that gap: a 56px green circle raised
  15px out of the capsule. It belongs to the *screen*, not the shell — each
  page registers its own through `usePageAction` and the shell renders whatever
  is there. A top-right "+" is the hardest point on a phone to reach; the
  middle of the bottom edge is the easiest. Because it sits in the strip the
  content already pads for, it never covers a row.

  | Screen | Action |
  |--------|--------|
  | Home | `+` → Add menu: Task · Habit · Identity (B10) |
  | Tasks | `+` → new task |
  | Habits · Today | `+` → new habit |
  | Habits · Identities | `+` → new identity |
  | Insights | ▶ → `/focus` |
  | Any detail screen | none — its "+" sits beside the count it adds to |

- **Settings** is a gear in the screen header, not a destination.
- `/focus` and the first-run overlay own the whole viewport and hide the bar.
- **Daylight layer** sits behind everything at `z-index: 0`.
- **Offline / sync state** — a 3px hairline bar under the header,
  `--text-tertiary` when syncing, hidden otherwise. No banners, no toasts for
  normal sync.

### Screen map

Design lives in `pencil-new.pen`; the IDs below are its frame names.

| Group | Screens |
|-------|---------|
| Onboarding | A1 focus · A2 purpose · A3 install |
| Home & Focus | B0 first run · B1 today · B2 session running · B3 running · B4 paused · B5 break · B6 complete · B7 attach task · B8 plan today · B9 reset confirm · B10 add menu |
| Tasks | C1 active · C2 empty · C3 completed · C4 detail · C5–C9 sheets · C10 swipe · C11 undo |
| Habits | D1 today · D2 identities · D3 identity · D4 habit · D5 new identity · D6 new habit · D7 delete identity |
| Insights | E1 insights · E2 empty · E3 achievements · E4 day detail |
| Settings & system | F1 settings · F2–F5 sheets · F6 offline |

---

## B1 — Home · `/`

The screen users open ten times a day. It must be instant, it must be quiet,
and it must answer one question: how is today going, and what is next.

Home is **not** the timer. The timer has its own screen; putting it here made
every other thing on the page feel like a footnote to a clock.

```
┌──────────────────────────────────┐
│  ◍  Sukun                    ⚙︎  │
│     6 day streak · Wednesday     │
│                                  │
│  ┌ Focusing · Update API docs ─┐ │  B2 only — charcoal, tap → /focus
│  │ 24:13 left · session 3 of 4 ⏸│ │
│  └──────────────────────────────┘ │
│  ┌────────────────── green ────┐ │
│  │ Today          [ Wednesday ]│ │
│  │ 3/8  done · 3 tasks and     │ │
│  │      2 habits left          │ │
│  │ ▁ ▃ ▂ ▅ ▇ ▂ ▄               │ │  7 days of focus time
│  └──────────────────────────────┘ │
│  ┌─ 6 ────────┐ ┌─ 86% ───────┐  │
│  │ day streak │ │ habit       │  │
│  │ best is 14 │ │ consistency │  │
│  └────────────┘ └─────────────┘  │
│  ┌──────────────────────────────┐ │
│  │ Today's tasks  [1 of 4] [📅] │ │
│  │ ▣ Update API docs        ▶  │ │
│  │ ▣ Review pull requests   ▶  │ │
│  └──────────────────────────────┘ │
│  ┌──────────────────────────────┐ │
│  │ Today's habits    [2 of 4]   │ │
│  │ Read one spec       🔥7  ○  │ │
│  │ Morning walk        🔥6  ●  │ │
│  └──────────────────────────────┘ │
│        [ Tasks ]  (+)  [ Habits ] │
└──────────────────────────────────┘
```

**Elements**

1. **Header** — charcoal logo tile, "Sukun", and one line of state (streak +
   weekday). Settings gear on the right. No back button; this is home.
2. **Now focusing banner** (B2) — renders only while the machine is not idle.
   Charcoal, 64px, taps through to `/focus`, carries one pause/resume control.
3. **Today hero** — green card. `done/total` across tasks *and* habits, because
   a day is made of both. Seven bars underneath: focus time per day for the
   trailing week, normalised to that week's maximum; a zero day still draws an
   8% stub, because a gap is information.
4. **Stat tiles** — day streak (→ `/insights`) and 30-day habit consistency
   (→ `/habits`).
5. **Today's tasks** — up to four rows: planned-for-today, or the open tasks if
   the day hasn't been planned. Row taps open the task; the green play button
   attaches it and opens `/focus`, which is the shortest path from "what should
   I do" to working. A running row shows pause instead. The `📅` in the card
   head opens the planner (B8).
6. **Today's habits** — everything scheduled today, ungrouped: the identity is
   the point on the Habits screen, here the question is just "did I do it".

**States**

| State | Behaviour |
|-------|-----------|
| First run (B0) | Hero reads `0/0 · Nothing planned yet`; both cards show their empty state with one chip — "Add a task", "Add a habit". Streak tile reads "starts today", consistency reads "no habits yet". |
| Session running (B2) | Banner appears; the attached task's row swaps its meta for `Focusing · 24:13 left` in `--green-deep` and its play button for pause. |
| Everything done | Hero sub reads "done · that's everything". |
| Loading | Cards render at their skeleton height; no number is shown until IndexedDB resolves. Never render a wrong number. |

---

## B8 — Plan today · `/plan`

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
overflow: tasks that don't fit stay unplanned; the result toast
          reads "7 planned · 3 didn't fit"
```

Three refinements the implementation settled:

- **High priority falls back to the evening.** The list above stops at the afternoon, but leaving a high-priority task unplanned while a block still has room is plainly wrong. Overflow should mean "the day is full", not "the day is full in the two places I looked". Every priority now has all three blocks in its preference order; only the order differs.
- **An estimate of zero costs one slot,** and a task larger than any single block may take a whole empty one. Otherwise a 6-pomodoro task would overflow forever, and zero-estimate tasks would stuff a block without limit.
- **Dragging a task pins it.** A manual move sets `plannedManually`, which is what makes Auto-plan safe to press again — it fills around anything you placed yourself, and the pinned task's estimate still consumes its block's capacity.

**Auto-plan never moves a task the user placed by hand.** Manual placement sets `planned_manually = true` locally; Auto-plan only fills around those. This is the answer to the open question in the reference post — respecting manual overrides is what makes the button safe to press twice.

Pressing Auto-plan a second time in the same session offers **Undo** in a toast for 6 seconds.

**Empty state** — "Nothing planned yet. Auto-plan will spread your open tasks across the day." with the Auto-plan button as the primary action.

---

## B3–B6 — Focus · `/focus`

The running timer, full bleed, and nothing else: one number, one progress line,
the task it belongs to, and three controls in the thumb zone. Focus is green; a
break inverts to charcoal, so looking up tells you which side of the cycle you
are on without reading a word.

The flip clock is gone. It was a second way to render the same machine, it
owned a settings row and a route, and nobody needs two clocks.

```
┌──────────────────────────────────┐
│  (⌄)     [ Session 3 of 4 ]  (🔊)│
│                                  │
│              FOCUS               │
│             24:13                │  display-xl, tabular
│         ▬▬▬▬▬▬▬▬▬▭▭▭▭▭           │
│        ( ＋ Update API docs )    │  tap → B7 attach sheet
│            ● ● ▬ ○               │  session dots
│                                  │
│      ( ⟲ )   ( ⏸ )   ( ⏭ )      │  56 · 80 · 56
│        Next: break · 5m          │
└──────────────────────────────────┘
```

- **Minimise** (⌄) returns to Home with the clock still running. This screen is
  a *view* of the machine, never the machine itself.
- **Reset** asks for confirmation (B9) only when more than 60 seconds have
  elapsed — below that, asking is friction.
- **Paused** (B4) drops the digits to 55% opacity and the pill reads `Paused`.
- **Break** (B5) inverts to charcoal; the task pill becomes "Stand up. Look at
  something far away." and Skip becomes End break.
- **Complete** (B6) shows the finished session's length instead of a countdown,
  with "Start break · 5m" and "Skip break, keep going". The break length comes
  from the machine's own `nextPhase` applied to the post-session count, so the
  hint can never disagree with what happens.
- Not orientation-locked, and the screen wake lock is re-taken when the tab
  becomes visible again — a lock is dropped whenever the tab is hidden.

---

## C1–C3 — Tasks · `/tasks`

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

## C5/C6 — Create / edit a task · sheet over `/tasks`

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

## C4 — Task detail · `/tasks/[id]`

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

- **Header actions** — export (JSON to clipboard), edit (opens C5 sheet), delete (confirm → soft delete → back to `/tasks` with a 6s Undo toast).
- **Start focus session** attaches the task and routes to `/`, timer running.
- **Subtask row** — checkbox, title (inline-editable on tap), priority badge (tap cycles high → medium → low), updated date, an always-visible delete button, and a grip handle to reorder.

  Reordering uses Motion's `Reorder` rather than a drag-and-drop library: the list is short, vertical, and single-axis, which is exactly what it covers. A grip handle rather than long-press-anywhere, because long-press on a row that is also tap-to-edit makes both gestures feel unreliable. Delete is a visible button rather than a swipe — a hidden swipe action is the only way to delete on touch, and a hidden-only affordance for a destructive-but-undoable action is worse than a small button.
- **Auto-complete parent:** when the last subtask is checked, show a toast — "All subtasks done. Mark task complete?" with a Complete action. Never auto-complete silently; a checklist finishing is not the same as work being finished, and silent state changes erode trust.
- **Session history** — every session logged against this task, newest first, capped at 10 with a "Show all" expander.
- **No AI generate button in v1.** See [01-prd.md](01-prd.md) §8.

---

## E1–E4 — Insights · `/insights`

Reports and Personal Bests folded into one screen. They answered the same
question at two zoom levels, and neither earned a tab of its own.

```
┌──────────────────────────────────┐
│  Insights                  🏆 ⚙︎ │
│  [ Week ][ Month ][ Year ]       │
│  ┌────────────────── green ────┐ │
│  │ Focused in September [This ▾]│ │
│  │ 18h 40m   +12% vs August    │ │
│  │ ▁ ▃ ▂ ▅ ▇ ▂ ▄               │ │
│  └──────────────────────────────┘ │
│  ┌ 46 sessions ┐ ┌ 6 day streak ┐│
│  ┌ 3h 10m best ┐ ┌ 31 tasks     ┐│
│  ┌ Where focus went    [By tag] ┐│
│  │   ◯51% work  ◯29%  ●20%      ││
│  ┌ Focus rhythm      [12 weeks] ┐│
│  │ M ▪▪▫▪▪▫▪▪▪▫▪▪               ││
│  │ Less ▫▪▪▪▪ More  Jun 23–Sep15││
│  ┌ Records ────────────────────┐ │
│  │ 🔥 Longest streak    14 days│ │
│  │ ▶  Most in a day          9 │ │
│  │ ⏱  Total focus     184h 20m │ │
│  ┌ Achievements  [6 of 22]   › ┐ │
└──────────────────────────────────┘
```

**Range** — Week / Month / Year. Everything below re-reads through that window;
the hero names the period ("Focused in September"), not the control.

- **Hero** — total focus time, and the change against the *previous period of
  the same kind*. No previous period means no percentage: a first week with no
  history is not an infinite improvement.
- **Bars** — seven days for a week, weeks (W1–W5) for a month, twelve months
  for a year.
- **Stat tiles** — sessions in range · current streak (with best) · best day in
  range, by *time* not session count · tasks completed in range.
- **Where focus went** — circles sized by area, one per tag, biggest first.
  A task contributes its first tag only: splitting a session across two tags
  would make the shares total more than the time actually spent. Everything
  past the top three merges into "Other", and the shares always sum to 100
  (largest-remainder rounding).
- **Focus rhythm** — 12 weeks × 7 days. Five discrete steps —
  `--track`, `--green-soft`, `--green-mid`, `--green`, `--text-primary` — not
  one colour at five opacities; the top step is charcoal so a heavy day reads
  at a glance on a grey canvas. Columns and rows flex to the card's width
  rather than scrolling sideways. Row labels follow the configured week start.
  Tapping a cell opens **E4**.
- **Records** — longest streak, most sessions in a day, total focus time. All
  time, never windowed: a record you can lose by changing a dropdown is not a
  record.
- **Achievements card** — count plus four badges, most recently unlocked first
  then the next locked ones. Taps through to E3.
- **E2 (empty)** — hero, both streak tiles and one card: "Nothing to show yet /
  Finish one focus session and your rhythm, records and streak start filling in
  here" with a **Start a session** chip. The hero still renders its empty bars;
  the shape of the thing is the motivation.
- **E4 (day detail)** — a sheet: the date, a "Best day 🏆" pill when it is one,
  sessions and time as two tiles, then every focus session that day — start
  time, a dot (green completed / ember interrupted), the task, the length.

All figures are computed locally by `getInsights(range)`, one read of the
session table rather than eight live queries that would each re-read it and
then disagree with one another for a frame. See [06](06-data-contracts.md) §4.

### E3 — Achievements · `/insights/achievements`

A page, not a sheet: 22 badges in five groups is a screen's worth of content.
Green hero with `6 / 22`, the next badge's name and its requirement, and a
progress bar. Then one card per group — First steps · Sessions · Streaks ·
Depth · Consistency — each with an `n of m` chip and a three-column grid.
Locked badges keep their requirement (as a tooltip and for screen readers):
a goal you cannot see is not a goal.

Evaluated after every completed session. Unlock shows a single quiet toast —
badge icon, name, one line. No modal, no confetti.

### Achievement catalog (22)

| Group | Badges |
|-------|--------|
| First steps | First session · First task done · First full day · First week |
| Volume | 10 · 50 · 100 · 250 · 500 · 1000 sessions |
| Streaks | 3 · 7 · 14 · 30 · 100 day streaks |
| Depth | 4 sessions in one day · 8 in one day · 3 hours in a day · 10 hours in a week |
| Habit | Every day of one week · One month, no gaps · 100 tasks completed |

---

## D1–D7 — Habits · `/habits`

Two views of the same thing: what has to happen today, and who the habits are
supposed to be making you. Identity is the organising idea, so it gets a tab
rather than a settings corner.

- **D1 · Today** — green hero (`3 / 5`, "2 left · best streak 12 days", seven
  bars of completion rate against what was *scheduled* that day). Then one card
  per identity that has something due, each with an `n of m` chip and its habit
  rows: name, flame pill, 36px check.
- **D2 · Identities** — hero counts identities, habits and the best streak.
  Then one row per identity: tile, name, "2 habits · 1 done today", a progress
  track that turns green when the day is clear, and a chevron.
- **D3 · Identity** — tile, editable name, chips (habit count · since · best
  streak), a "This week" hero of check-ins, and the habits card. **Adding a
  habit is a `+` beside the count**, not a button at the bottom: the count is
  what you are looking at when you decide there should be one more. Two stat
  tiles (kept this month · check-ins since) and a quiet destructive row.
- **D4 · Habit** — editable name, identity and schedule chips, a "Current
  streak" hero, the schedule as seven toggles, a month calendar you can
  back-fill by tapping a day, and done/missed tiles. Nothing is behind an edit
  mode: this screen is where a missed check-in gets fixed.
- **D5 · New identity** — sheet. "Habits hang off who you want to be. Write it
  as a person, not a goal." One field plus four starting points.
- **D6 · New habit** — sheet. Identity chips, name, then the schedule: seven
  day toggles pre-set to weekdays, with Every day / Weekdays / Weekends
  presets. A habit can never end up scheduled on no days.
- **D7 · Delete identity** — confirm sheet; the identity and all its habits go.

Streak maths lives in `lib/habits/streaks.ts`. Today not yet done never breaks
a streak — the day is not over.

---

## F1–F5 — Settings · `/settings`

Grouped inset list, iOS style.

| Group | Rows |
|-------|------|
| **Timer** | Focus length · Short break · Long break · Sessions until long break · Auto-start breaks · Auto-start focus |
| **Sound & alerts** | Alert sound (5 options, tap to preview) · Volume · Notifications (requests permission) · Haptics |
| **Appearance** | Theme (System / Light / Dark) · Week starts on |
| **Account** | Signed out → "Sync across devices" with an email field, and a footnote making clear the app already works without one. Signed in → email, Sync now, Sign out ("Everything stays on this device"). No anonymous accounts. |
| **Data** | Export JSON · Import JSON · Delete all data (type DELETE to confirm) |
| **About** | Version · What's new · Send feedback (mailto) · Privacy |

Duration rows open a wheel-style picker sheet, not a number input. Every change saves immediately — no Save button anywhere in settings.

---

## A1–A3 — First run · overlay on `/`

Three cards, skippable. Runs once, gated on `profiles.onboarded_at`.

Each card **previews the thing it describes** rather than illustrating it —
the first screen of an app should look like the app. "Skip" sits at the top
right, the dots and a charcoal primary button at the bottom.

1. **"Work in focused blocks."** — the green hero mid-session, `25:00`,
   "Session 1 of 4". Twenty-five on, five off; the timer keeps running when you
   switch tabs, lock the phone, or close the laptop.
2. **"Give every session a purpose."** — three task rows, one already done.
   Attach a task to the timer; estimates, subtasks and a plan for today keep
   the next block obvious.
3. **"Keep it on your home screen."** — the app icon on a green card. Shown
   only when not already standalone. On iOS Safari: the Share → Add to Home
   Screen instructions, because notifications don't work otherwise. On
   Chromium: a single **Install** button wired to the captured
   `beforeinstallprompt` event, with **Not now** under it.

The overlay ships in the HTML and is revealed by a blocking script's attribute,
so a first visit paints it immediately instead of waiting for hydration and an
IndexedDB read. After mount it checks IndexedDB and dismisses itself if there
is any history — localStorage can lie.

Notification permission is **not** requested here. Ask after the user's first
completed session, in context: "Want an alert when a session ends?" A cold
permission prompt on first load gets denied, and a denied prompt is permanent.
