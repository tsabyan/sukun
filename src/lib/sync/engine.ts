import { db, getMeta, META_KEYS, setMeta } from '@/lib/db/schema'
import { adoptUserId, currentUserId } from '@/lib/db/identity'
import { pending, resetAttempts } from './outbox'
import {
  CONFLICT_TARGET,
  FULL_PULL_TABLES,
  PULL_TABLES,
  PUSH_ORDER,
  REMOTE_TABLE,
  fromRemote,
  toRemote,
} from './mappers'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { useSyncStore } from './state'
import type { OutboxEntry, SyncTable } from '@/lib/db/types'

/**
 * Push the outbox, pull the deltas — docs/02-architecture.md §5.
 *
 * Sync is a background nicety, never a blocker. Everything it touches has
 * already been written to IndexedDB; if the network is gone, the project is
 * paused, or the user never signs in, the app is unaffected.
 */

/**
 * How often a cycle runs while the tab is visible — and the only cadence at
 * which ordinary writes leave the device.
 *
 * Pushing a couple of seconds after each write was tried and deliberately
 * dropped: it turned one task into its own round trip and multiplied requests
 * against the database for no benefit the user can see. The outbox exists so
 * writes can wait. Nothing is at risk while they do — the row is already
 * durable in IndexedDB, and the cycle also runs on sign-in, on reconnect, and
 * whenever the tab comes back to the foreground, so leaving and returning
 * flushes the queue well before this interval would.
 */
const PULL_INTERVAL_MS = 5 * 60_000
/**
 * How many failures before an entry is *reported* as stalled. It is a
 * reporting threshold, not a death sentence: the entry keeps being retried at
 * the backoff cap forever.
 *
 * It used to be both, and that was the bug — `isReady` dropped anything at ten
 * attempts from the queue while `pushOnce` went on counting it as stalled, so
 * the status pill read "Waiting" for the rest of the install's life with no
 * way back. Rows poisoned once during development stayed poisoned after the
 * cause was long fixed, and clearing IndexedDB was the only cure. Issue #8.
 */
const MAX_ATTEMPTS = 10
const BACKOFF_CAP_MS = 5 * 60_000
const PUSH_BATCH = 200

/** 1s, 2s, 4s … capped at five minutes, and it stays there. */
function backoffFor(attempts: number): number {
  return Math.min(BACKOFF_CAP_MS, 1000 * 2 ** Math.max(0, attempts - 1))
}

export function isReady(entry: OutboxEntry, now: number): boolean {
  if (entry.attempts === 0) return true
  // createdAt doubles as the last-attempt marker; it is bumped on failure.
  return now - entry.createdAt >= backoffFor(entry.attempts)
}

/* -------------------------------------------------------------------- push */

/**
 * The two insert-only tables, pushed without needing a session.
 *
 * Both carry signal about people who never sign in, and both would be useless
 * if they waited for an account. Waitlist conversion is the price signal the
 * validation plan rests on; device heartbeats are how guests are counted at
 * all. Stranding either in the outbox would quietly report zero.
 */
const ANON_TABLES = ['waitlist', 'deviceDays'] as const

async function pushAnonTables(userId: string | null): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const now = Date.now()
  const queued = await pending(PUSH_BATCH)

  for (const table of ANON_TABLES) {
    const entries = queued.filter((entry) => entry.table === table && isReady(entry, now))
    if (entries.length === 0) continue

    const rows = entries.map((entry) => ({
      ...toRemote(table, entry.payload),
      // A nullable FK to auth.users. The device-local id is not a uuid and
      // would fail the constraint, so signed out sends null.
      user_id: userId,
    }))

    try {
      // Insert, never upsert: these tables have an INSERT policy and
      // deliberately no UPDATE policy, and PostgREST needs both to upsert.
      // A duplicate is success — that email is already on the list, or that
      // device was already counted today.
      const { error } = await supabase.from(REMOTE_TABLE[table]).insert(rows)
      if (error && error.code !== '23505') throw error
      await db.outbox.bulkDelete(entries.map((e) => e.id))
    } catch (error) {
      console.warn(`[ajeg] ${table} push failed`, error)
      await db.transaction('rw', db.outbox, async () => {
        for (const entry of entries) {
          await db.outbox.update(entry.id, {
            attempts: entry.attempts + 1,
            createdAt: Date.now(),
          })
        }
      })
    }
  }
}

async function pushOnce(userId: string): Promise<{ pushed: number; stalled: number }> {
  const supabase = getSupabase()
  if (!supabase) return { pushed: 0, stalled: 0 }

  const now = Date.now()
  const all = (await pending(PUSH_BATCH)).filter(
    (entry) => !ANON_TABLES.includes(entry.table as (typeof ANON_TABLES)[number]),
  )
  const ready = all.filter((entry) => isReady(entry, now))

  // Counted from what is *left* after the push, never from what was there
  // before it: an entry that just succeeded is gone, and reporting the count
  // taken on the way in left the pill reading "Waiting" for one more cycle
  // after the queue had already drained.
  const stalledNow = async () =>
    (await pending(PUSH_BATCH)).filter(
      (entry) =>
        !ANON_TABLES.includes(entry.table as (typeof ANON_TABLES)[number]) &&
        entry.attempts >= MAX_ATTEMPTS,
    ).length

  if (ready.length === 0) return { pushed: 0, stalled: await stalledNow() }

  // Batched by table so one round trip carries many rows, but kept in oldest
  // -first order within each table so intent is preserved.
  const byTable = new Map<SyncTable, OutboxEntry[]>()
  for (const entry of ready) {
    const list = byTable.get(entry.table) ?? []
    list.push(entry)
    byTable.set(entry.table, list)
  }

  let pushed = 0

  // Parents before children — PUSH_ORDER, not the order the outbox happened to
  // batch them in. A session pushed before its task is a 23503 on
  // sessions_task_id_fkey, and it never recovers on its own: the session keeps
  // failing and the task keeps succeeding, so the pair is stuck for good.
  const tables = [...byTable.keys()].sort(
    (a, b) => PUSH_ORDER.indexOf(a) - PUSH_ORDER.indexOf(b),
  )

  for (const table of tables) {
    const entries = byTable.get(table)!
    const upserts = entries.filter((e) => e.op === 'upsert')
    const deletes = entries.filter((e) => e.op === 'delete')

    try {
      if (upserts.length > 0) {
        // One row per rowId, the newest wins. Editing a task three times
        // leaves three outbox entries, and Postgres refuses an ON CONFLICT DO
        // UPDATE whose input names the same key twice (21000). Only the last
        // payload matters — the earlier ones are states this row has already
        // passed through — but every superseded entry still has to be deleted
        // on success, which is why the map holds entries rather than rows.
        const latest = new Map<string, OutboxEntry>()
        for (const entry of upserts) latest.set(entry.rowId, entry)

        const rows = [...latest.values()].map((entry) => ({
          ...toRemote(table, entry.payload),
          user_id: userId,
        }))

        const { error } = await supabase
          .from(REMOTE_TABLE[table])
          .upsert(rows, {
            onConflict: CONFLICT_TARGET[table as Exclude<SyncTable, 'waitlist' | 'deviceDays'>],
          })
        if (error) throw error
      }

      // Only join rows are ever hard-deleted; everything else soft-deletes and
      // travels as an ordinary upsert.
      for (const entry of deletes) {
        const payload = entry.payload as { taskId?: string; tagId?: string }
        if (table === 'taskTags' && payload.taskId && payload.tagId) {
          const { error } = await supabase
            .from(REMOTE_TABLE[table])
            .delete()
            .eq('task_id', payload.taskId)
            .eq('tag_id', payload.tagId)
          if (error) throw error
        }
      }

      await db.outbox.bulkDelete(entries.map((e) => e.id))
      pushed += entries.length
    } catch (error) {
      // Spelled out rather than logged as an object: a PostgrestError prints
      // as `{}` in some consoles, and the code is the whole diagnosis —
      // 42501 is RLS, PGRST204 a missing column, 23503 a dangling foreign key.
      const detail = error as { code?: string; message?: string; hint?: string } | null
      console.warn(
        `[ajeg] sync push failed for ${table}`,
        detail?.code ?? '',
        detail?.message ?? error,
        detail?.hint ?? '',
      )
      // Bump attempts and reset the clock so backoff applies from now.
      await db.transaction('rw', db.outbox, async () => {
        for (const entry of entries) {
          await db.outbox.update(entry.id, {
            attempts: entry.attempts + 1,
            createdAt: Date.now(),
          })
        }
      })
    }
  }

  return { pushed, stalled: await stalledNow() }
}

/* -------------------------------------------------------------------- pull */

const LOCAL_TABLE = {
  tasks: () => db.tasks,
  subtasks: () => db.subtasks,
  tags: () => db.tags,
  sessions: () => db.sessions,
  settings: () => db.settings,
  achievements: () => db.achievements,
  taskTags: () => db.taskTags,
  identities: () => db.identities,
  habits: () => db.habits,
} as const

async function pullTable(table: SyncTable): Promise<number> {
  const supabase = getSupabase()
  // Neither insert-only table is ever read back.
  if (!supabase || table === 'waitlist' || table === 'deviceDays') return 0

  const cursors = (await getMeta<Record<string, string>>(META_KEYS.lastPulledAt)) ?? {}
  const since = cursors[table] ?? '1970-01-01T00:00:00.000Z'

  const query = supabase.from(REMOTE_TABLE[table]).select('*')
  // Some tables have no updated_at at all and are pulled whole — see
  // FULL_PULL_TABLES. Asking them for a delta is a 42703.
  const whole = FULL_PULL_TABLES.includes(table)
  const { data, error } = whole
    ? await query
    : await query.gt('updated_at', since).order('updated_at', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) return 0

  let newest = since

  await db.transaction('rw', [db.tasks, db.subtasks, db.tags, db.taskTags, db.sessions, db.settings, db.achievements, db.identities, db.habits, db.habitLogs, db.outbox], async () => {
    const queued = new Set((await db.outbox.toArray()).map((e) => `${e.table}:${e.rowId}`))

    for (const raw of data) {
      const row = fromRemote<Record<string, unknown>>(raw as Record<string, unknown>)
      const updatedAt = (row.updatedAt as string) ?? since
      if (updatedAt > newest) newest = updatedAt

      const key =
        table === 'settings'
          ? (row.userId as string)
          : table === 'achievements'
            ? (row.key as string)
            : table === 'taskTags'
              ? `${row.taskId}:${row.tagId}`
              : table === 'habitLogs'
                ? `${row.habitId}:${row.day}`
                : (row.id as string)

      // Last-write-wins on updatedAt, except that a row with something still
      // queued locally keeps the local copy — that is the user's most recent
      // intent, on the device they are holding.
      if (queued.has(`${table}:${key}`)) continue

      if (table === 'taskTags') {
        await db.taskTags.put(row as never)
        continue
      }

      // habit_logs has a compound primary key [habitId+day], so it cannot go
      // through the id-keyed store map — but it does carry updated_at, so it
      // still gets last-write-wins rather than the pulled-whole treatment.
      if (table === 'habitLogs') {
        const composite: [string, string] = [row.habitId as string, row.day as string]
        const current = await db.habitLogs.get(composite)
        if (current?.updatedAt && current.updatedAt >= updatedAt) continue
        await db.habitLogs.put(row as never)
        continue
      }

      const store = LOCAL_TABLE[table as keyof typeof LOCAL_TABLE]()
      const existing = await (store as { get: (k: string) => Promise<unknown> }).get(key)
      const existingUpdatedAt = (existing as { updatedAt?: string } | undefined)?.updatedAt
      if (existingUpdatedAt && existingUpdatedAt >= updatedAt) continue

      await (store as { put: (v: unknown) => Promise<unknown> }).put(row)
    }
  })

  if (!whole) {
    await setMeta(META_KEYS.lastPulledAt, { ...cursors, [table]: newest })
  }

  return data.length
}

/* ------------------------------------------------------------------- cycle */

let running = false
/** A cycle was asked for while one was already in flight; run once more after. */
let rerun = false

/**
 * @param retryStalled  Clear the attempt counters first, so entries sitting at
 *   the backoff cap are tried immediately. Set it for a sync the user asked
 *   for by name; leave it off for the timers and the online listener, which
 *   must not defeat the backoff they exist to respect.
 */
export async function syncNow({ retryStalled = false } = {}): Promise<void> {
  if (!isSupabaseConfigured()) return
  // Overlapping cycles would push the same rows twice. Remember the request
  // instead of dropping it: a write that landed mid-cycle is exactly the one
  // that would otherwise wait out a full interval.
  if (running) {
    rerun = true
    return
  }

  const supabase = getSupabase()
  if (!supabase) return

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSyncStore.getState().set({ state: 'offline' })
    return
  }

  let remoteUserId: string | undefined
  try {
    const { data } = await supabase.auth.getSession()
    remoteUserId = data.session?.user.id
  } catch {
    // Unreachable project. Nothing to report — the write already landed
    // locally and the outbox will still be there next time.
    useSyncStore.getState().set({ state: 'offline' })
    return
  }

  // Signed out is the normal state, not an error. Only the waitlist moves.
  if (!remoteUserId) {
    running = true
    try {
      await pushAnonTables(null)
    } finally {
      running = false
      useSyncStore.getState().set({ state: 'idle' })
    }
    drainRerun()
    return
  }

  running = true
  useSyncStore.getState().set({ state: 'syncing' })

  // Names the step that threw. The catch below reports the whole cycle as
  // stalled, which is right for the user and useless for anyone reading the
  // console: "sync cycle failed {}" says neither which half failed nor why.
  let step = 'start'

  try {
    if (retryStalled) await resetAttempts()

    // Everything created before sign-in carries the device-local id. Rewriting
    // it onto the account is what makes those rows visible to RLS — with
    // anonymous auth this was a no-op, so it is now the step that matters.
    step = 'adopt'
    if ((await currentUserId()) !== remoteUserId) await adoptUserId(remoteUserId)

    step = 'push:anon'
    await pushAnonTables(remoteUserId)

    step = 'push'
    const { stalled } = await pushOnce(remoteUserId)
    for (const table of PULL_TABLES) {
      step = `pull:${table}`
      await pullTable(table)
    }
    step = 'pull:profile'
    await pullProfile(remoteUserId)

    useSyncStore.getState().set({
      state: stalled > 0 ? 'stalled' : 'idle',
      lastSyncedAt: Date.now(),
      pendingCount: await db.outbox.count(),
    })
  } catch (error) {
    // Spelled out for the same reason as the push failure above: a
    // PostgrestError logged as an object prints as `{}` in some consoles, and
    // the code is the whole diagnosis.
    const detail = error as { code?: string; message?: string; hint?: string } | null
    console.warn(
      `[ajeg] sync cycle failed at ${step}`,
      detail?.code ?? '',
      detail?.message ?? error,
      detail?.hint ?? '',
    )
    useSyncStore.getState().set({ state: 'stalled' })
  } finally {
    running = false
  }

  drainRerun()
}

/** Runs the cycle that was requested while the last one was still going. */
function drainRerun(): void {
  if (!rerun) return
  rerun = false
  void syncNow()
}

/**
 * The profile carries one thing the app reads: whether this account is Pro.
 * It is not a synced table — there is nothing to push and one row to pull — so
 * it is mirrored straight into meta. A failure here is silent on purpose: an
 * unreachable profile must never downgrade someone mid-session.
 */
async function pullProfile(userId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const { data, error } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return
  await setMeta(META_KEYS.isPro, data.is_pro === true)
}

/** Sign-in, reconnect, and every five minutes while the tab is visible. */
export function startSync(): () => void {
  if (!isSupabaseConfigured() || typeof window === 'undefined') {
    useSyncStore.getState().set({ state: 'disabled' })
    return () => {}
  }

  const tick = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }

  void syncNow()
  const interval = setInterval(tick, PULL_INTERVAL_MS)

  const onOnline = () => void syncNow()
  const onVisible = () => tick()

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', () =>
    useSyncStore.getState().set({ state: 'offline' }),
  )
  document.addEventListener('visibilitychange', onVisible)

  const supabase = getSupabase()
  const { data: listener } = supabase?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') void syncNow()
  }) ?? { data: null }

  return () => {
    clearInterval(interval)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    listener?.subscription.unsubscribe()
  }
}

export { useSyncStore } from './state'
export type { SyncState } from './state'
