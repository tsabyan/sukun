'use client'

import { useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ChipButton } from '@/components/ui/Pill'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { cn } from '@/lib/utils/cn'
import { today as todayLocal, toLocalDate, fromLocalDate } from '@/lib/utils/dates'
import {
  ALL_DAYS,
  DOW,
  DOW_FULL,
  currentStreak,
  isScheduled,
  longestStreak,
  rate30,
  type DoneSet,
} from '@/lib/habits/streaks'
import type { Habit, LocalDate } from '@/lib/db/types'

export function HabitDetail({
  habit,
  identityName,
  done,
  onBack,
  onRename,
  onToggleScheduleDay,
  onToggleDay,
  onDelete,
}: {
  habit: Habit
  identityName: string
  done: DoneSet
  onBack: () => void
  onRename: (name: string) => void
  onToggleScheduleDay: (weekday: number) => void
  onToggleDay: (day: LocalDate) => void
  onDelete: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const today = todayLocal()
  const cur = currentStreak(habit, done, today)
  const longest = longestStreak(habit, done, today)
  const rate = rate30(habit, done, today)

  const now = fromLocalDate(today)
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1)
  const lead = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 self-start text-body-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> {identityName}
      </button>

      <input
        value={habit.name}
        placeholder="Habit name"
        onChange={(e) => onRename(e.target.value)}
        className="w-full bg-transparent text-title-m font-display text-ink outline-none placeholder:text-ink-3"
      />

      <Card className="grid grid-cols-3 gap-2 text-center">
        <Stat value={cur} label="Current streak" accent />
        <Stat value={longest} label="Longest" />
        <Stat value={`${rate}%`} label="30 days" />
      </Card>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-label text-ink-2">Schedule</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => (
            <ChipButton
              key={d}
              selected={habit.schedule.includes(d)}
              onClick={() => onToggleScheduleDay(d)}
            >
              {DOW_FULL[d]}
            </ChipButton>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-label text-ink-2">{monthName}</h2>
        <div className="grid grid-cols-7 gap-1.5">
          {DOW.map((d, i) => (
            <div key={`h${i}`} className="pb-1 text-center text-[11px] font-medium text-ink-3">
              {d}
            </div>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const iso = toLocalDate(new Date(year, month, day))
            const isDone = done.has(iso)
            const sched = isScheduled(habit, iso)
            const future = iso > today
            const isToday = iso === today
            const clickable = !future && sched
            return (
              <button
                key={day}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onToggleDay(iso)}
                aria-label={`${iso}${isDone ? ', done' : ''}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md text-body-sm tabular-nums',
                  'transition-colors duration-150',
                  future && 'text-ink-3 opacity-50',
                  !future && isDone && 'bg-accent font-medium text-on-accent',
                  !future && !isDone && sched && 'bg-surface-sunken text-ink-2 hover:text-ink',
                  !future && !sched && 'text-ink-3',
                  isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-canvas',
                )}
              >
                {day}
              </button>
            )
          })}
        </div>
      </section>

      <Button variant="destructive" onClick={() => setConfirmOpen(true)} className="self-start">
        <Trash2 size={16} strokeWidth={1.75} /> Delete habit
      </Button>

      <ConfirmSheet
        open={confirmOpen}
        title="Delete this habit?"
        body={`"${habit.name || 'This habit'}" and its history will be removed.`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={cn('text-title-m font-display tabular-nums', accent ? 'text-accent' : 'text-ink')}
      >
        {value}
      </span>
      <span className="text-[11px] text-ink-3">{label}</span>
    </div>
  )
}
