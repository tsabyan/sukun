import { db } from '@/lib/db/schema'
import type { OutboxEntry, SyncTable } from '@/lib/db/types'
import { newId } from '@/lib/utils/ids'

/**
 * Every mutation writes twice inside one Dexie transaction: the row itself and
 * an outbox entry. docs/02-architecture.md §5.
 *
 * The draining half lands in Phase 8. Writing the entries from day one costs
 * nothing now and means there is no retrofit later — by the time sync exists,
 * the queue is already correct.
 */

export async function enqueue(
  table: SyncTable,
  rowId: string,
  op: OutboxEntry['op'],
  payload: unknown,
) {
  await db.outbox.put({
    id: newId(),
    table,
    rowId,
    op,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  })
}

/** Oldest first — order of intent is preserved on push. */
export function pending(limit = 500) {
  return db.outbox.orderBy('createdAt').limit(limit).toArray()
}

export async function pendingCount(): Promise<number> {
  return db.outbox.count()
}

export async function clearOutbox() {
  await db.outbox.clear()
}

/**
 * Put every failed entry back at the front of the queue.
 *
 * Only ever called from a deliberate "Sync now": a person pressing the button
 * is telling us that whatever was rejecting these rows — a signed-out session,
 * a paused project, a policy that has since been fixed — is worth testing
 * again right now rather than at the end of the next backoff. `createdAt` is
 * left alone so the order of intent survives the reset.
 *
 * Returns how many entries were revived, so the caller can say nothing at all
 * when the answer is zero.
 */
export async function resetAttempts(): Promise<number> {
  return db.outbox.filter((entry) => entry.attempts > 0).modify({ attempts: 0 })
}
