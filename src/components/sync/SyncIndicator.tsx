'use client'

import { useSyncStore } from '@/lib/sync/state'
import { cn } from '@/lib/utils/cn'

/**
 * A 3px hairline under the header — docs/05-screens.md, global shell.
 *
 * Normal sync says nothing at all. There is no toast for success, and no
 * dialog for failure: a background process that interrupts you to report it is
 * working is a background process that has misunderstood its job.
 */
export function SyncIndicator() {
  const state = useSyncStore((s) => s.state)

  if (state === 'idle' || state === 'disabled') return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[3px] overflow-hidden"
    >
      <span
        className={cn(
          'block h-full',
          state === 'syncing' && 'w-1/3 animate-[sukun-sync_1.2s_ease-in-out_infinite] bg-ink-3',
          state === 'offline' && 'w-full bg-hairline-strong',
          state === 'stalled' && 'w-full bg-ember/40',
        )}
      />
      <span className="sr-only">
        {state === 'syncing' && 'Syncing'}
        {state === 'offline' && 'Offline — changes are saved on this device'}
        {state === 'stalled' && 'Some changes could not sync yet'}
      </span>
    </div>
  )
}
