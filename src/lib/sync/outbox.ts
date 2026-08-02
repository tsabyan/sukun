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
