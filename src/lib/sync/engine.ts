import { db, getMeta, META_KEYS, setMeta } from '@/lib/db/schema'
import { adoptUserId, currentUserId } from '@/lib/db/identity'
import { pending } from './outbox'
import { CONFLICT_TARGET, PULL_TABLES, REMOTE_TABLE, fromRemote, toRemote } from './mappers'
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

const PULL_INTERVAL_MS = 5 * 60_000
const MAX_ATTEMPTS = 10
const BACKOFF_CAP_MS = 5 * 60_000
const PUSH_BATCH = 200

/** 1s, 2s, 4s … capped at five minutes. */
function backoffFor(attempts: number): number {
  return Math.min(BACKOFF_CAP_MS, 1000 * 2 ** Math.max(0, attempts - 1))
}

function isReady(entry: OutboxEntry, now: number): boolean {
  if (entry.attempts === 0) return true
  if (entry.attempts >= MAX_ATTEMPTS) return false
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
      console.warn(`[sukun] ${table} push failed`, error)
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
  const stalled = all.filter((entry) => entry.attempts >= MAX_ATTEMPTS).length

  if (ready.length === 0) return { pushed: 0, stalled }

  // Batched by table so one round trip carries many rows, but kept in oldest
  // -first order within each table so intent is preserved.
  const byTable = new Map<SyncTable, OutboxEntry[]>()
  for (const entry of ready) {
    const list = byTable.get(entry.table) ?? []
    list.push(entry)
    byTable.set(entry.table, list)
  }

  let pushed = 0

  for (const [table, entries] of byTable) {
    const upserts = entries.filter((e) => e.op === 'upsert')
    const deletes = entries.filter((e) => e.op === 'delete')

    try {
      if (upserts.length > 0) {
        const rows = upserts.map((entry) => ({
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
      console.warn(`[sukun] sync push failed for ${table}`, error)
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

  return { pushed, stalled }
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
} as const

async function pullTable(table: SyncTable): Promise<number> {
  const supabase = getSupabase()
  // Neither insert-only table is ever read back.
  if (!supabase || table === 'waitlist' || table === 'deviceDays') return 0

  const cursors = (await getMeta<Record<string, string>>(META_KEYS.lastPulledAt)) ?? {}
  const since = cursors[table] ?? '1970-01-01T00:00:00.000Z'

  const query = supabase.from(REMOTE_TABLE[table]).select('*')
  // task_tags has no updated_at — it is a join row that is only ever created
  // or removed, so it is pulled whole. It is also tiny.
  const { data, error } =
    table === 'taskTags'
      ? await query
      : await query.gt('updated_at', since).order('updated_at', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) return 0

  let newest = since

  await db.transaction('rw', [db.tasks, db.subtasks, db.tags, db.taskTags, db.sessions, db.settings, db.achievements, db.outbox], async () => {
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
              : (row.id as string)

      // Last-write-wins on updatedAt, except that a row with something still
      // queued locally keeps the local copy — that is the user's most recent
      // intent, on the device they are holding.
      if (queued.has(`${table}:${key}`)) continue

      const store = LOCAL_TABLE[table as keyof typeof LOCAL_TABLE]()
      if (table === 'taskTags') {
        await db.taskTags.put(row as never)
        continue
      }

      const existing = await (store as { get: (k: string) => Promise<unknown> }).get(key)
      const existingUpdatedAt = (existing as { updatedAt?: string } | undefined)?.updatedAt
      if (existingUpdatedAt && existingUpdatedAt >= updatedAt) continue

      await (store as { put: (v: unknown) => Promise<unknown> }).put(row)
    }
  })

  if (table !== 'taskTags') {
    await setMeta(META_KEYS.lastPulledAt, { ...cursors, [table]: newest })
  }

  return data.length
}

/* ------------------------------------------------------------------- cycle */

let running = false

export async function syncNow(): Promise<void> {
  if (running || !isSupabaseConfigured()) return

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
    return
  }

  running = true
  useSyncStore.getState().set({ state: 'syncing' })

  try {
    // Everything created before sign-in carries the device-local id. Rewriting
    // it onto the account is what makes those rows visible to RLS — with
    // anonymous auth this was a no-op, so it is now the step that matters.
    if ((await currentUserId()) !== remoteUserId) await adoptUserId(remoteUserId)

    await pushAnonTables(remoteUserId)

    const { stalled } = await pushOnce(remoteUserId)
    for (const table of PULL_TABLES) await pullTable(table)

    useSyncStore.getState().set({
      state: stalled > 0 ? 'stalled' : 'idle',
      lastSyncedAt: Date.now(),
      pendingCount: await db.outbox.count(),
    })
  } catch (error) {
    console.warn('[sukun] sync cycle failed', error)
    useSyncStore.getState().set({ state: 'stalled' })
  } finally {
    running = false
  }
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
