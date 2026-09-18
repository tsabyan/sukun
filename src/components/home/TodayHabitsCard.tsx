'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Check, Flame, Plus, Sprout } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pill, ChipButton } from '@/components/ui/Pill'
import { spring } from '@/lib/motion/tokens'
import { cn } from '@/lib/utils/cn'
import type { Habit } from '@/lib/db/types'

export interface HomeHabit {
  habit: Habit
  done: boolean
  streak: number
}

/**
 * B1 — "Today's habits".
 *
 * Only what is scheduled today, ungrouped: the identity a habit belongs to is
 * the point on the Habits screen, but here the question is just "did I do it".
 */
export function TodayHabitsCard({
  habits,
  onToggle,
  onAdd,
}: {
  habits: HomeHabit[]
  onToggle: (habitId: string) => void
  onAdd: () => void
}) {
  const done = habits.filter((h) => h.done).length

  return (
    <Card className="flex flex-col gap-3">
      <CardHead title="Today's habits">
        {habits.length > 0 && <Pill>{`${done} of ${habits.length} done`}</Pill>}
      </CardHead>

      {habits.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="No habits yet"
          body="Habits are small things you repeat. Group them under an identity you want to grow into."
          action={
            <ChipButton selected onClick={onAdd}>
              <Plus size={14} strokeWidth={2} aria-hidden />
              Add a habit
            </ChipButton>
          }
        />
      ) : (
        <ul className="flex flex-col">
          {habits.map((row) => (
            <HabitRow key={row.habit.id} row={row} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function HabitRow({ row, onToggle }: { row: HomeHabit; onToggle: (id: string) => void }) {
  const { habit, done, streak } = row

  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link
        href="/habits"
        className={cn('min-w-0 flex-1 truncate text-body', done ? 'text-ink-2' : 'text-ink')}
      >
        {habit.name}
      </Link>

      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1',
          streak > 0 ? 'bg-green-soft text-green-deep' : 'bg-field text-ink-3',
        )}
      >
        <Flame size={12} strokeWidth={1.75} aria-hidden />
        <span className="numerals text-body-sm font-medium">{streak}</span>
        <span className="sr-only">day streak</span>
      </span>

      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        transition={spring.snappy}
        aria-pressed={done}
        aria-label={done ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
        onClick={() => onToggle(habit.id)}
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-full border',
          'transition-colors duration-150',
          done
            ? 'border-transparent bg-green text-on-accent'
            : 'border-hairline-strong bg-surface text-ink-3 hover:border-green',
        )}
      >
        {done && <Check size={16} strokeWidth={3} aria-hidden />}
      </motion.button>
    </li>
  )
}
