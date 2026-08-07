import { db, META_KEYS } from './schema'

/**
 * Who owns the rows on this device.
 *
 * Every row carries a userId because Postgres RLS keys on it. Until auth
 * lands in Phase 8 there is no real user, so a stable device-local id stands
 * in. When anonymous sign-in arrives, `adoptUserId` rewrites existing rows to
 * the Supabase uid once — after that the two agree forever.
 */

const FALLBACK_USER_ID = 'local-device'

let cached: string | null = null

export async function currentUserId(): Promise<string> {
  if (cached) return cached

  const stored = await db.meta.get(META_KEYS.userId)
  if (typeof stored?.value === 'string') {
    cached = stored.value
    return cached
  }

  // Pure read: the fallback id is deterministic, so returning it without
  // persisting is safe — and it MUST NOT write, because this runs inside
  // read-only liveQuery transactions (getSettings, stats). ensureUserId
  // persists it once at startup in a writable context.
  cached = FALLBACK_USER_ID
  return cached
}

/**
 * Persist the device id once, from a writable context (app startup). Splitting
 * the write out of currentUserId is what keeps every liveQuery read safe.
 */
export async function ensureUserId(): Promise<string> {
  const stored = await db.meta.get(META_KEYS.userId)
  if (typeof stored?.value === 'string') {
    cached = stored.value
    return cached
  }
  await db.meta.put({ key: META_KEYS.userId, value: FALLBACK_USER_ID })
  cached = FALLBACK_USER_ID
  return cached
}

/** Phase 8: called once after the first anonymous sign-in. */
export async function adoptUserId(nextUserId: string) {
  const previous = await currentUserId()
  if (previous === nextUserId) return

  await db.transaction(
    'rw',
    [db.tasks, db.subtasks, db.tags, db.taskTags, db.sessions, db.achievements, db.identities, db.habits, db.habitLogs, db.settings, db.meta],
    async () => {
      // Unrolled rather than looped: the tables have different row types, so a
      // loop collapses them to a union and `modify` stops being callable.
      await db.tasks.toCollection().modify({ userId: nextUserId })
      await db.subtasks.toCollection().modify({ userId: nextUserId })
      await db.tags.toCollection().modify({ userId: nextUserId })
      await db.taskTags.toCollection().modify({ userId: nextUserId })
      await db.sessions.toCollection().modify({ userId: nextUserId })
      await db.achievements.toCollection().modify({ userId: nextUserId })
      await db.identities.toCollection().modify({ userId: nextUserId })
      await db.habits.toCollection().modify({ userId: nextUserId })
      await db.habitLogs.toCollection().modify({ userId: nextUserId })

      const settings = await db.settings.get(previous)
      if (settings) {
        await db.settings.delete(previous)
        await db.settings.put({ ...settings, userId: nextUserId })
      }

      await db.meta.put({ key: META_KEYS.userId, value: nextUserId })
    },
  )

  cached = nextUserId
}

/** Test seam. */
export function resetIdentityCache() {
  cached = null
}
