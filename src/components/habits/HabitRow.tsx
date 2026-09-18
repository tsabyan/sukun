'use client'

import { motion } from 'motion/react'
import { Check, Flame } from 'lucide-react'
import { spring } from '@/lib/motion/tokens'
import { cn } from '@/lib/utils/cn'

/** The flame pill that travels with every habit — D1, D3, Home. */
export function StreakPill({ count }: { count: number }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1',
        count > 0 ? 'bg-green-soft text-green-deep' : 'bg-field text-ink-3',
      )}
    >
      <Flame size={12} strokeWidth={1.75} aria-hidden />
      <span className="numerals text-body-sm font-medium">{count}</span>
      <span className="sr-only">day streak</span>
    </span>
  )
}

/**
 * One habit, one row: what it is, how long the run is, and the only control
 * that matters today. Used on Home, on Habits and inside an identity.
 */
export function HabitRow({
  name,
  meta,
  streak,
  done,
  onOpen,
  onToggle,
}: {
  name: string
  /** schedule and streak, when the row has the space for it */
  meta?: string
  streak: number
  done: boolean
  onOpen?: () => void
  onToggle: () => void
}) {
  const label = name || 'Untitled habit'

  return (
    <li className="flex items-center gap-3 py-2.5">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <Label name={label} meta={meta} done={done} />
        </button>
      ) : (
        <span className="min-w-0 flex-1">
          <Label name={label} meta={meta} done={done} />
        </span>
      )}

      <StreakPill count={streak} />

      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        transition={spring.snappy}
        aria-pressed={done}
        aria-label={done ? `Mark ${label} not done` : `Mark ${label} done`}
        onClick={onToggle}
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

function Label({ name, meta, done }: { name: string; meta?: string; done: boolean }) {
  return (
    <>
      <span className={cn('block truncate text-body', done ? 'text-ink-2' : 'text-ink')}>
        {name}
      </span>
      {meta && <span className="block truncate text-body-sm text-ink-2">{meta}</span>}
    </>
  )
}
