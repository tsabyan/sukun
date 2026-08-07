'use client'

import { useState } from 'react'
import { ArrowLeft, Flame, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { HabitCheck } from './HabitCheck'
import { cn } from '@/lib/utils/cn'
import { today as todayLocal, toLocalDate, fromLocalDate } from '@/lib/utils/dates'
import { currentStreak, isScheduled, schedLabel, type DoneSet } from '@/lib/habits/streaks'
import type { Habit, Identity, LocalDate } from '@/lib/db/types'

export function IdentityDetail({
  identity,
  habits,
  logs,
  onBack,
  onRenameIdentity,
  onDeleteIdentity,
  onAddHabit,
  onOpenHabit,
  onToggleToday,
}: {
  identity: Identity
  habits: Habit[]
  logs: Record<string, Set<LocalDate>>
  onBack: () => void
  onRenameIdentity: (name: string) => void
  onDeleteIdentity: () => void
  onAddHabit: (name: string) => void
  onOpenHabit: (habitId: string) => void
  onToggleToday: (habitId: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const add = () => {
    if (!draft.trim()) return
    onAddHabit(draft)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 self-start text-body-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> All identities
      </button>

      <div className="flex flex-col gap-1">
        <span className="text-body-sm text-ink-3">I want to become…</span>
        <input
          value={identity.name}
          placeholder="e.g. A guitarist"
          onChange={(e) => onRenameIdentity(e.target.value)}
          className="w-full bg-transparent text-title-m font-display text-ink outline-none placeholder:text-ink-3"
        />
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          placeholder="Add a habit…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="h-11 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3.5 text-body text-ink outline-none placeholder:text-ink-3 focus:border-accent"
        />
        <IconButton label="Add habit" variant="primary" onClick={add}>
          <Plus size={20} strokeWidth={2} />
        </IconButton>
      </div>

      {habits.length === 0 ? (
        <Card>
          <p className="text-body text-ink-2">
            No habits yet. Add the small, daily things that would prove this identity true.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {habits.map((h) => (
            <li key={h.id}>
              <HabitCard
                habit={h}
                done={logs[h.id] ?? new Set()}
                onOpen={() => onOpenHabit(h.id)}
                onToggleToday={() => onToggleToday(h.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Button variant="destructive" onClick={() => setConfirmOpen(true)} className="self-start">
        <Trash2 size={16} strokeWidth={1.75} /> Delete identity
      </Button>

      <ConfirmSheet
        open={confirmOpen}
        title="Delete this identity?"
        body="This identity and all its habits will be removed."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDeleteIdentity}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function HabitCard({
  habit,
  done,
  onOpen,
  onToggleToday,
}: {
  habit: Habit
  done: DoneSet
  onOpen: () => void
  onToggleToday: () => void
}) {
  const today = todayLocal()
  const cur = currentStreak(habit, done, today)
  const doneToday = done.has(today)

  return (
    <Card padding="compact" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="truncate text-body font-medium text-ink">{habit.name || 'Untitled habit'}</div>
          <div className="truncate text-body-sm text-ink-3">
            {schedLabel(habit.schedule)} · {cur > 0 ? `streak ${cur}` : 'not started'}
          </div>
        </button>
        <StreakBadge count={cur} />
        <HabitCheck done={doneToday} onToggle={onToggleToday} />
      </div>
      <FourteenDayStrip habit={habit} done={done} today={today} />
    </Card>
  )
}

export function StreakBadge({ count }: { count: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-body-sm tabular-nums',
        count > 0 ? 'text-accent' : 'text-ink-3',
      )}
    >
      <Flame size={15} strokeWidth={1.75} />
      <b>{count}</b>
    </span>
  )
}

function FourteenDayStrip({ habit, done, today }: { habit: Habit; done: DoneSet; today: LocalDate }) {
  const base = fromLocalDate(today)
  const cells = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const iso = toLocalDate(d)
    const isDone = done.has(iso)
    const sched = isScheduled(habit, iso)
    cells.push(
      <span
        key={iso}
        aria-hidden
        className={cn(
          'h-1.5 flex-1 rounded-full',
          isDone ? 'bg-accent' : sched ? 'bg-hairline-strong' : 'bg-hairline',
        )}
      />,
    )
  }
  return <div className="flex gap-1">{cells}</div>
}
