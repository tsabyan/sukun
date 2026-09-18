'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { Trophy } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Pill } from '@/components/ui/Pill'
import { StatRow, StatTile } from '@/components/ui/StatTile'
import { getSessionsOnDay, live } from '@/lib/db/repo'
import { formatDuration, fromLocalDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'
import type { HeatmapCell } from '@/lib/db/types'

/** E4 — one day of the heat grid, opened by tapping a cell. */
export function DaySheet({
  cell,
  isBest,
  onClose,
}: {
  cell: HeatmapCell | null
  /** the best day of the current range — worth saying so */
  isBest: boolean
  onClose: () => void
}) {
  const data = useLiveQuery(async () => {
    if (!cell) return null
    const [sessions, tasks] = await Promise.all([getSessionsOnDay(cell.date), live.tasks()])
    return {
      sessions: sessions.filter((s) => s.mode === 'focus'),
      titleOf: new Map(tasks.map((task) => [task.id, task.title])),
    }
  }, [cell?.date])

  const sessions = data?.sessions ?? []
  const focusSeconds = sessions.reduce((sum, s) => sum + s.actualDurationSec, 0)

  return (
    <Sheet
      open={cell !== null}
      onClose={onClose}
      snapPoints={[0.62, 0.92]}
      title={
        cell
          ? fromLocalDate(cell.date).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })
          : ''
      }
      action={
        isBest ? (
          <Pill tone="dark">
            <Trophy size={12} strokeWidth={1.75} aria-hidden />
            Best day
          </Pill>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        <StatRow>
          <StatTile value={String(sessions.length)} label="sessions" />
          <StatTile value={formatDuration(focusSeconds)} label="focused" />
        </StatRow>

        {sessions.length === 0 ? (
          <p className="px-1 py-2 text-body text-ink-2">No focus sessions on this day.</p>
        ) : (
          <ul className="flex flex-col rounded-lg bg-field px-4 py-1">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-2.5 py-2.5">
                <span className="numerals shrink-0 text-body-sm font-medium text-ink-2">
                  {new Date(session.startedAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    session.completed ? 'bg-green' : 'bg-ember',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-ink">
                  {(session.taskId && data?.titleOf.get(session.taskId)) || 'No task'}
                </span>
                <span className="numerals shrink-0 text-body-sm text-ink-2">
                  {formatDuration(session.actualDurationSec)}
                  {session.completed ? '' : ' · interrupted'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
