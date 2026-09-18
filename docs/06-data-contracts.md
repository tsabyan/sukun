# 06 — Data Contracts

Single source of truth for types and the data-access boundary. Everything in `src/lib/db/`.

## 1. Domain types

```ts
// src/lib/db/types.ts

export type Priority = 'low' | 'medium' | 'high'
export type TaskStatus = 'active' | 'completed' | 'archived'
export type SessionMode = 'focus' | 'short_break' | 'long_break'
export type DayBlock = 'morning' | 'afternoon' | 'evening'
export type TaskColor =
  | 'sage' | 'slate' | 'iris' | 'apricot' | 'clay' | 'moss' | 'fog' | 'plum'

/** ISO date, no time: '2026-08-02' */
export type LocalDate = string
/** ISO 8601 with offset */
export type Timestamp = string

export interface Task {
  id: string
  userId: string
  title: string
  description: string | null
  icon: string                 // lucide icon name
  color: TaskColor
  category: string | null
  priority: Priority
  status: TaskStatus
  estimatedPomodoros: number
  completedPomodoros: number
  dueDate: LocalDate | null
  plannedDate: LocalDate | null
  plannedBlock: DayBlock | null
  plannedOrder: number
  plannedManually: boolean     // local only — Auto-plan must not move these
  recurrence: Recurrence | null
  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt: Timestamp | null
  deletedAt: Timestamp | null
}

export interface Recurrence {
  freq: 'weekly'
  days: number[]               // 0 = Sunday … 6 = Saturday
}

export interface Subtask {
  id: string
  userId: string
  taskId: string
  title: string
  priority: Priority
  isDone: boolean
  position: number
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export interface Tag {
  id: string
  userId: string
  name: string
  color: TaskColor
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export interface Session {
  id: string
  userId: string
  taskId: string | null
  mode: SessionMode
  plannedDurationSec: number
  actualDurationSec: number
  startedAt: Timestamp
  endedAt: Timestamp
  localDate: LocalDate         // user-local calendar day — drives every stat
  completed: boolean           // ran to zero
  interrupted: boolean         // skipped or reset early
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null
}

export interface Settings {
  userId: string
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  soundId: string
  volume: number               // 0–1
  notificationsEnabled: boolean
  theme: 'system' | 'light' | 'dark'
  defaultTimerMode: 'ring' | 'flip'
  weekStartsOn: number         // 0–6
  updatedAt: Timestamp
}

export interface Achievement {
  key: string
  unlockedAt: Timestamp
}
```

**Casing:** camelCase in TypeScript, snake_case in Postgres. Convert in one place — `lib/sync/mappers.ts` — and nowhere else.

## 2. Timer machine

Pure functions in `lib/timer/machine.ts`, unit tested. No React, no Dexie, no `Date.now()` inside — time is always an argument. That's what makes it testable.

```ts
export interface TimerRuntime {
  phase: SessionMode
  status: 'idle' | 'running' | 'paused'
  startedAt: number | null     // epoch ms
  endsAt: number | null        // epoch ms
  pausedAt: number | null
  plannedDurationSec: number   // the duration THIS phase started with
  taskId: string | null
  cycleCount: number           // completed focus sessions in the current cycle
}

export type TimerEvent =
  | { type: 'START'; now: number; durations: Durations }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'RESET'; now: number; durations: Durations }
  | { type: 'SKIP'; now: number; durations: Durations }
  | { type: 'COMPLETE'; now: number; durations: Durations }
  | { type: 'ATTACH_TASK'; taskId: string | null }

export interface Durations {
  focus: number; shortBreak: number; longBreak: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean; autoStartFocus: boolean
}

export function reduce(
  state: TimerRuntime,
  event: TimerEvent,
): { state: TimerRuntime; session?: SessionOutcome }

export function remainingMs(state: TimerRuntime, now: number): number
export function elapsedMs(state: TimerRuntime, now: number): number
export function nextPhase(phase: SessionMode, cycleCount: number, d: Durations): SessionMode
```

`reduce` returns an optional `SessionOutcome` whenever a phase ends — the caller persists it. The machine never writes anything itself.

**`SessionOutcome`, not `SessionDraft`.** The outcome carries epoch milliseconds (`startedAtMs`, `endedAtMs`) rather than ISO strings and a `localDate`. Converting to the storage shape needs a date library and a timezone opinion, and keeping both out of the reducer is what makes it trivially testable. The store does the conversion in one place.

**Why `plannedDurationSec` is on the runtime.** Pause time is derived as `(endsAt - startedAt) - plannedDuration`. Reading the duration from current settings instead would corrupt that arithmetic the moment a user edits their focus length mid-session — the session would report the wrong elapsed time. It also gives the idle state something correct to display.

**Invariants the tests must assert**

1. `remainingMs` never goes negative.
2. Pause then resume after N ms shifts `endsAt` by exactly N.
3. `COMPLETE` at `now > endsAt` records `endedAt = endsAt`, not `now`. A session never reports more time than it ran.
4. `SKIP` during focus records `interrupted: true, completed: false` and `actualDurationSec` = the real elapsed time.
5. `cycleCount` increments only on a *completed* focus phase, and resets after a long break.
6. Break sessions are recorded but excluded from every stat.
7. A `START` on an already-running timer is a no-op, not a restart.

## 3. Repository interface

The only path to data. No component imports Dexie or the Supabase client.

```ts
// src/lib/db/repo.ts

export interface Repo {
  // — tasks
  listTasks(filter?: {
    status?: TaskStatus
    tagIds?: string[]
    sort?: 'recent' | 'priority' | 'due' | 'alpha'
  }): Promise<Task[]>
  getTask(id: string): Promise<Task | undefined>
  createTask(input: CreateTaskInput): Promise<Task>
  updateTask(id: string, patch: Partial<Task>): Promise<void>
  completeTask(id: string): Promise<void>
  deleteTask(id: string): Promise<void>          // soft
  restoreTask(id: string): Promise<void>
  countActiveTasks(): Promise<number>

  // — planner
  listPlanned(date: LocalDate): Promise<Task[]>
  setPlacement(
    id: string,
    block: DayBlock | null,
    order: number,
    manual: boolean,
  ): Promise<void>
  autoPlan(date: LocalDate): Promise<{ placed: number; overflow: number }>
  undoAutoPlan(): Promise<void>

  // — subtasks
  listSubtasks(taskId: string): Promise<Subtask[]>
  createSubtask(taskId: string, title: string): Promise<Subtask>
  updateSubtask(id: string, patch: Partial<Subtask>): Promise<void>
  reorderSubtasks(taskId: string, orderedIds: string[]): Promise<void>
  deleteSubtask(id: string): Promise<void>

  // — tags
  listTags(): Promise<Tag[]>
  createTag(name: string, color: TaskColor): Promise<Tag>
  setTaskTags(taskId: string, tagIds: string[]): Promise<void>

  // — sessions
  recordSession(draft: SessionDraft): Promise<Session>
  listSessions(range: { from: LocalDate; to: LocalDate }): Promise<Session[]>
  listSessionsForTask(taskId: string): Promise<Session[]>

  // — settings
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<void>

  // — stats
  getStreaks(): Promise<{ current: number; longest: number }>
  getWeekDots(): Promise<Array<{ date: LocalDate; active: boolean }>>
  getDayStats(date?: LocalDate): Promise<DayStats>
  getHeatmap(weeks: number): Promise<HeatmapCell[]>
  getRecentDayTotals(days: number): Promise<DayStats[]>
  getInsights(range: 'week' | 'month' | 'year'): Promise<Insights>
  getSessionsOnDay(date: LocalDate): Promise<Session[]>
  getAchievements(): Promise<Achievement[]>
  evaluateAchievements(): Promise<string[]>      // returns newly unlocked keys

  // — data
  exportAll(): Promise<ExportBundle>
  importAll(bundle: ExportBundle): Promise<void>
  deleteAllData(): Promise<void>
}
```

Read paths in components use `useLiveQuery` against Dexie directly *through repo-provided query builders* — the async methods above are for mutations and computed reads. Keep the split explicit so live-updating lists don't get stuck behind promises. The builders live on `repo.live`.

**Phased implementation.** The interface was complete from Phase 1 so the contract never moved. Methods belonging to later phases threw an error naming their phase rather than returning something plausible and wrong; all of them are now implemented (`autoPlan` and `undoAutoPlan` in Phase 5, `getHeatmap`, `getPersonalBests` and `evaluateAchievements` in Phase 6).

`getPersonalBests` and `getMonthlyActivity` still exist and are still tested, but no screen calls them: the v2 Insights screen (docs/05 E1) folded both into `getInsights`. They stay because the period-ranking maths behind them is the expensive part to get right, and a compact "personal bests" widget is a likely next use.

`getStreaks`, `getWeekDots`, and `getDayStats` landed early, in Phase 1, because the Focus Timer's streak card (Phase 3) needed them before the reports screen existed.

## 4. Stats shapes

```ts
export interface HeatmapCell {
  date: LocalDate
  sessions: number
  focusSeconds: number
  level: 0 | 1 | 2 | 3 | 4     // intensity bucket
}

export interface PersonalBests {
  bestDay:   { label: string; focusSeconds: number; sessions: number } | null
  bestWeek:  { label: string; focusSeconds: number; sessions: number } | null
  bestMonth: { label: string; focusSeconds: number; sessions: number } | null
  currentStreak: number
  longestStreak: number
  currentPeriod: { focusSeconds: number; sessions: number; pctOfBest: number }
  rankings: Array<{
    label: string; focusSeconds: number; sessions: number; isCurrent: boolean
  }>
}
```

### Insights (docs/05 E1)

One call per range, not eight. Every figure on that screen is a different slice
of the same session table; eight live queries would each re-read it and then
disagree with one another for a frame.

```ts
export type InsightRange = 'week' | 'month' | 'year'

export interface Insights {
  range:        InsightRange
  title:        string        // "Focused in September"
  chip:         string        // "This month"
  focusSeconds: number
  sessions:     number
  delta:        string | null // "+12% vs August"; null with no history
  bars:         Array<{ key: string; label: string; focusSeconds: number }>
  bestDay:      { date: LocalDate; label: string; focusSeconds: number; sessions: number } | null
  tasksCompleted: number
  streaks:      { current: number; longest: number }
  breakdown:    Array<{ name: string; focusSeconds: number; share: number }>
  heatmap:      HeatmapCell[]
  heatmapLabel: string        // "Jun 23 – Sep 15"
  weekStartsOn: number
  records:      { longestStreak: number; mostSessionsInADay: number; totalFocusSeconds: number }
  achievements: { unlocked: Set<string>; total: number }
  empty:        boolean       // nothing has ever been recorded
}
```

**Windows are inclusive on both ends** and come from the calendar, not from a
rolling count of days: a week is the configured week, a month is the calendar
month, a year is the calendar year. The comparison period is the same kind of
period immediately before, so "this month vs last month" compares 30 days with
31 — which is what the words mean.

**`delta` is null when the previous period has no time in it.** A first week
with no history is not an infinite improvement.

**`bars`** are seven days for a week, seven-day chunks (`W1`…`W5`) for a month,
and twelve months for a year.

**`breakdown`** attributes each session to its task's *first* tag, alphabetically,
or `Untagged`. Splitting one session across two tags would make the shares total
more than the time actually spent — a rough answer beats a wrong one. Everything
past the top three merges into `Other`, and the shares always sum to exactly 100
(largest-remainder rounding), biggest first.

**`records`** are all-time and never windowed. A record you can lose by changing
a dropdown is not a record.

Pure functions in `lib/stats/insights.ts`, tested in `insights.test.ts`.

**Intensity buckets** are relative to the user's own p90 daily session count over the visible range, floored at 4. A user who does 2 sessions a day should see a full-looking heatmap; a fixed absolute scale makes light users feel they're failing, which is the opposite of what this app is for.

```
p90 = 90th percentile of non-zero daily session counts, min 4
level = 0 if sessions == 0
        else clamp(ceil(sessions / p90 * 4), 1, 4)
```

## 5. Validation

Zod schemas in `lib/db/validators.ts`, applied at two boundaries only:

1. **Form submit** — before `createTask` / `updateTask`.
2. **Import / sync pull** — never trust a JSON file or a remote row.

Not applied on internal calls. Validating on every read is a tax with no payer.

```ts
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().default(null),
  icon: z.string().default('circle-dashed'),
  color: z.enum(TASK_COLORS).default('sage'),
  priority: z.enum(['low','medium','high']).default('medium'),
  estimatedPomodoros: z.number().int().min(0).max(50).default(1),
  dueDate: z.string().date().nullable().default(null),
  plannedBlock: z.enum(['morning','afternoon','evening']).nullable().default(null),
  recurrence: z.object({
    freq: z.literal('weekly'),
    days: z.array(z.number().int().min(0).max(6)).min(1),
  }).nullable().default(null),
  tagIds: z.array(z.string().uuid()).default([]),
})
```

## 6. IDs and timestamps

- IDs: `crypto.randomUUID()`, generated client-side. Same ID in IndexedDB and Postgres, which is what makes upsert-based sync idempotent.
- `updatedAt`: set client-side on every local write *and* by the Postgres trigger on every remote write. The sync engine compares the two; skew under a second is harmless with last-write-wins.
- `localDate`: `format(new Date(startedAt), 'yyyy-MM-dd')` in the user's timezone at the moment the session starts. Written once, never recomputed — a user who flies to another timezone should not have last week's heatmap shift.

## 7. Export bundle

```ts
export interface ExportBundle {
  version: 1
  exportedAt: Timestamp
  tasks: Task[]
  subtasks: Subtask[]
  tags: Tag[]
  taskTags: Array<{ taskId: string; tagId: string }>
  sessions: Session[]
  achievements: Achievement[]
  settings: Settings
}
```

Import is additive and idempotent: upsert by ID, keep the row with the newer `updatedAt`. Never wipe-and-replace — someone importing a stale backup should not lose this week's work.
