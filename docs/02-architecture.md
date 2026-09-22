# 02 — Architecture

## 1. Stack

| Layer | Choice | Why this one |
|-------|--------|--------------|
| Framework | **Next.js 16**, App Router, TypeScript strict | Vercel-native, zero-config deploy, RSC where useful. Most of this app is client-side. |
| Styling | **Tailwind CSS v4** + CSS custom properties | v4 reads design tokens from CSS vars — one source of truth for light/dark. |
| Animation | **Motion** (`motion/react`, formerly Framer Motion) | Spring physics, layout animations, `AnimatePresence` for sheets. |
| Local DB | **Dexie 4** (IndexedDB) + `dexie-react-hooks` | Live queries, transactions, no server round-trip. `useLiveQuery` re-renders on write. |
| Client state | **Zustand** | Timer machine + UI state. Tiny, no provider tree. |
| Remote DB / Auth | **Supabase** (Postgres + Auth + RLS) | Free tier, anonymous auth, row-level security means no backend to write. |
| PWA | **Serwist** (`@serwist/next`) | Maintained Workbox successor with first-class Next 16 support. |
| Charts | Hand-rolled SVG | Heatmap and bar chart are ~80 lines each. A chart library is 40KB for nothing. |
| Icons | **Lucide React** | Clean, consistent, tree-shakeable. |
| Class names | **clsx** + **tailwind-merge** (`cn()` in `lib/utils/cn.ts`) | Conditional classes with conflict resolution, so a `className` prop can override a component default instead of fighting it. 2KB combined. |
| Drag and drop | **@dnd-kit** (core, sortable, utilities) — planner only | Cross-container dragging with a keyboard sensor. Short single-axis lists (subtasks) use Motion's `Reorder` instead; dnd-kit earns its weight only where a row moves *between* containers. |
| Dates | **date-fns** v4 | Tree-shakeable, timezone-aware via `@date-fns/tz`. |
| Testing | **Vitest** + **fake-indexeddb** for repo tests; **Playwright** for the timer E2E | The timer is the one thing that must be tested properly. `fake-indexeddb` lets the whole data layer run under Node, so repo behaviour is asserted rather than clicked through; Playwright covers what only a browser can prove — a real Worker, a real backgrounded tab. |
| Icons | none | The app icons are cut from `public/images/app.jpeg` by hand and committed. The generator that rendered them from a vector mark is gone with the mark — docs/04 §0.1. **sharp** stays in the tree as Next's image dependency, not ours. |

**Deliberately not used:** any ORM (Supabase JS client is enough), Redux, a component library (the design is too specific to fight defaults), a charting library, `next-pwa` (unmaintained).

## 2. The core decision: local-first

IndexedDB is the source of truth. Supabase is a sync target, not a dependency.

```
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                 │
│   React UI ──useLiveQuery──▶ Dexie (IndexedDB) ◀── repository   │
│      │                            │                             │
│      │                            ▼                             │
│      │                      outbox table                        │
│      │                            │                             │
│      ▼                            ▼                             │
│  Timer Worker            SyncEngine (online + authed only)      │
│  (setInterval 250ms)              │                             │
└───────────────────────────────────┼─────────────────────────────┘
                                    ▼
                    Supabase Postgres (RLS: user_id = auth.uid())
```

Why this and not "just call Supabase":

- The app works on a plane, in a tunnel, with a dead Supabase project.
- Zero perceived latency — every write is an IndexedDB transaction, sub-millisecond.
- Free tier survives. Supabase egress is measured in bandwidth; a local-first app syncs deltas a few times an hour instead of querying on every render.
- Anonymous users need no network at all. Sync switches on only when they sign in.

**Cost:** you write a sync engine. It's about 200 lines. Spec below.

## 3. Timer accuracy — the thing most Pomodoro apps get wrong

**Never count down by decrementing a number in `setInterval`.** Browsers throttle background timers to once per minute (or freeze them entirely), so an interval-counted timer loses minutes.

### Model

A running phase is fully described by three fields, persisted to IndexedDB on every state change:

```ts
type TimerRuntime = {
  phase: 'focus' | 'short_break' | 'long_break'
  status: 'idle' | 'running' | 'paused'
  startedAt: number        // epoch ms — when this phase first started
  endsAt: number           // epoch ms — startedAt + duration + accumulated pause time
  pausedAt: number | null  // epoch ms — set on pause, cleared on resume
  taskId: string | null
  cycleCount: number       // focus sessions completed in the current long-break cycle
}
```

Remaining time is **always derived**, never stored:

```ts
const remainingMs = Math.max(0, endsAt - Date.now())
```

On resume: `endsAt += Date.now() - pausedAt`. Pausing is just shifting the finish line.

### Ticking

A **dedicated Web Worker** (`/workers/ticker.ts`) posts a message every 250ms. Workers are throttled far less aggressively than the main thread, and the tick only says "recompute" — it carries no state, so a dropped tick costs nothing.

Three additional recompute triggers, all mandatory:

1. `visibilitychange` → tab became visible.
2. `focus` on `window`.
3. `pageshow` → covers bfcache restore.

### Completion while backgrounded

The worker cannot fire a notification once it notices `endsAt` has passed *if the whole page is frozen*. Belt and braces:

1. **`setTimeout` alarm** scheduled for exactly `endsAt - Date.now()` on the main thread. Fires reliably when the tab is visible or lightly backgrounded.
2. **Worker tick check** — catches the case where the main thread timeout was throttled.
3. **Recompute-on-visible** — if the user returns after `endsAt`, complete the phase retroactively with the *correct* historical end time, not `Date.now()`.

For (3), record the session with `ended_at = endsAt`, not the wake-up time. A session must never report more elapsed time than it actually ran.

**Catch-up guard.** Complete at most one phase per return. With auto-start on, a user who closes the tab during a focus session and reopens it three hours later would otherwise have the machine chain through a dozen phases and manufacture a full afternoon of focus sessions they never sat through. So: the expired phase completes and is recorded honestly; if auto-start then hands over a phase whose clock has *also* already run out, that one drops straight to idle without being recorded. The user wasn't there for it.

### Audio on iOS

`AudioContext` starts `suspended` until a user gesture. Call `ctx.resume()` inside the Start button's click handler and keep a decoded buffer warm. Play a silent 1-sample buffer at that moment so iOS marks the context as user-activated for the rest of the session.

## 4. Folder layout

```
src/
├── app/
│   ├── layout.tsx                 # <html>, theme script, providers, shell
│   ├── page.tsx                   # B1 Home — today's tasks + habits
│   ├── plan/page.tsx              # B8 Plan today
│   ├── focus/page.tsx             # B3–B6 Focus (no chrome, no tab bar)
│   ├── tasks/page.tsx             # C1–C3 Tasks
│   ├── tasks/[id]/page.tsx        # C4 Task detail
│   ├── habits/page.tsx            # D1–D4 Habits (a client-routed stack)
│   ├── insights/page.tsx          # E1 Insights
│   ├── insights/achievements/…    # E3 Achievements
│   ├── settings/page.tsx          # F1 Settings
│   ├── auth/callback/route.ts     # magic-link handler
│   ├── manifest.ts                # PWA manifest
│   └── api/cron/keepalive/route.ts
├── components/
│   ├── ui/                        # Button, Sheet, Card, Segmented, Toggle, Field…
│   ├── shell/                     # AppShell (phone column + bottom bar), nav
│   ├── home/                      # NowFocusingBanner, Today's tasks / habits
│   ├── timer/                     # AttachTaskSheet, TimerEngine, announcer
│   ├── tasks/                     # TaskRow, SubtaskList, TaskFormSheet, icons
│   ├── habits/                    # HabitRow, Identity/Habit detail, sheets
│   ├── insights/                  # FocusBubbles, DaySheet
│   ├── planner/                   # BlockSection, PlannerRow, AutoPlanButton
│   └── charts/                    # Heatmap
├── lib/
│   ├── db/
│   │   ├── schema.ts              # Dexie table definitions + versions
│   │   ├── repo.ts                # ALL data access goes through here
│   │   └── seed.ts                # first-run defaults
│   ├── sync/
│   │   ├── engine.ts              # push outbox, pull deltas
│   │   └── outbox.ts              # enqueue / drain
│   ├── supabase/
│   │   ├── client.ts              # browser client
│   │   └── server.ts              # server client (auth callback only)
│   ├── timer/
│   │   ├── store.ts               # Zustand timer machine
│   │   ├── machine.ts             # pure phase transition logic (unit tested)
│   │   └── audio.ts               # AudioContext unlock + chime
│   ├── stats/
│   │   ├── aggregate.ts           # heatmap, daily totals, period ranking
│   │   ├── insights.ts            # ranges, bars, tag breakdown, records
│   │   └── achievements.ts        # catalog + unlock evaluation
│   ├── habits/streaks.ts          # schedules, streaks, 30-day rate
│   ├── ui/page-action.ts          # the screen's own floating action
│   ├── planner/autoplan.ts        # bucketing algorithm
│   └── utils/                     # cn, format, haptics, ids
├── workers/ticker.ts
├── hooks/
└── styles/globals.css             # design tokens as CSS vars
```

**Hard rule:** no component imports `dexie` or `@supabase/supabase-js` directly. Everything goes through `lib/db/repo.ts`. That's what makes the sync layer swappable and the components testable.

## 5. Sync engine

### Outbox pattern

Every mutation writes twice inside one Dexie transaction: the row itself, and an outbox entry.

```ts
type OutboxEntry = {
  id: string
  table: 'tasks' | 'subtasks' | 'sessions' | 'tags' | 'task_tags' | 'settings'
  rowId: string
  op: 'upsert' | 'delete'
  payload: unknown
  createdAt: number
  attempts: number
}
```

### Push

Drain the outbox oldest-first, batched by table, using Supabase `upsert`. On success delete the entry. On failure increment `attempts` and back off exponentially (1s, 2s, 4s… capped at 5 min). After 10 attempts, park the entry and surface a single non-blocking "sync issue" indicator — never a blocking error dialog.

### Pull

On sign-in, on reconnect, and every 5 minutes while the tab is visible:

```sql
select * from tasks where updated_at > :lastPulledAt
```

Store `lastPulledAt` per table in a Dexie `meta` table.

### Conflict resolution

Last-write-wins on `updated_at`, per row. If the remote row is newer than the local row *and* the local row has no pending outbox entry, overwrite locally. If a pending outbox entry exists, local wins — the user's most recent intent on the device they're holding.

This is correct enough for a single-user app. Don't build CRDTs.

### Deletes

Soft delete only. Every table has `deleted_at timestamptz`. Queries filter `deleted_at is null`. Hard-delete rows locally after 30 days. This makes delete sync trivial and gives you a free undo.

### Signed-out → signed-in migration

**There is no anonymous auth.** A user who never signs in has no Supabase session at all, and the app runs entirely on IndexedDB. That is the normal state, not a degraded one: first run asks for nothing, works offline, and leaves no account behind for someone who tried the app once.

The cost is that rows created before signing in carry a device-local `userId` (`local-device`) rather than a real `auth.uid()`. `adoptUserId()` in `lib/db/identity.ts` rewrites every local row onto the account uid, once, on the first sync after sign-in. Anonymous auth would have made this a no-op; without it, **this is the step that must not break** — if it fails, every pre-existing row is invisible to RLS and silently never syncs. It runs inside one Dexie transaction and is covered by tests.

Two consequences worth holding onto:

- **The waitlist pushes without a session.** Almost nobody hitting the Pro gate will have signed in, and waitlist conversion is the price signal the validation plan rests on. Those rows go up on the `anon` role with a null `user_id`; everything else waits for an account.
- **Signing out changes nothing locally.** No rows are deleted or hidden. The app simply stops syncing.

## 6. Rendering strategy

Almost everything is a client component — the data lives in the browser. Keep server components for the shell only (`layout.tsx`, static marketing copy).

Consequence: **guard the first paint against hydration flash.** Two things must be resolved before paint:

1. **Theme** — inline blocking script in `<head>` reads `localStorage.theme`, falls back to `prefers-color-scheme`, sets `data-theme` on `<html>`.

   Because that script has already written the correct value to the DOM, React must **read** the theme rather than own it. `lib/theme/store.ts` exposes the `<html>` attributes as an external store and `useTheme` subscribes with `useSyncExternalStore`. Copying the attribute into `useState` inside an effect would work, but it costs a cascading render on every mount and creates a second source of truth that can drift from the DOM. The same applies to `data-phase`.

2. **Timer state** — read from IndexedDB, which is async. Render the timer with a skeleton until the first read resolves (one frame, ~5ms). Do *not* render `25:00` and then snap to `13:42`.

## 7. Performance budget

| Metric | Budget |
|--------|--------|
| Initial JS (gzipped, `/`) | < 150 KB |
| LCP on 4G, mid-tier phone | < 1.5 s |
| Timer digit update | 60 fps, no layout thrash |
| Ring animation | Transform/opacity only. Never animate `stroke-dashoffset` on the main thread if it costs frames — prefer a rotated masked element. |
| Task list at 500 tasks | Virtualize with `@tanstack/react-virtual` above 100 rows |

Only the countdown digits re-render each tick. Subscribe with a Zustand selector on `remainingMs`; never lift the tick into a parent that re-renders the page.

## 8. Environment variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # magic-link redirect target
CRON_SECRET=                                  # guards /api/cron/keepalive
```

Never put the `service_role` key in this app. There is no server-side privileged path — RLS does all the authorization.
