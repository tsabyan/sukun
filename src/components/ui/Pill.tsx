'use client'

import { cn } from '@/lib/utils/cn'

type PillTone = 'neutral' | 'dark' | 'accent' | 'high' | 'medium' | 'low' | 'danger'

const TONES: Record<PillTone, string> = {
  /** the default: white on grey, or white on the lime hero */
  neutral: 'bg-surface text-ink border-hairline',
  /** charcoal — a value the eye should land on, e.g. "Session 3 of 4" */
  dark: 'bg-ink text-surface border-transparent',
  accent: 'bg-green-soft text-green-deep border-transparent',
  high: 'bg-priority-high/12 text-priority-high border-transparent',
  medium: 'bg-priority-medium/16 text-priority-medium border-transparent',
  low: 'bg-green-soft text-green-deep border-transparent',
  danger: 'bg-ember-soft text-ember border-transparent',
}

export function Pill({
  tone = 'neutral',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: PillTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5',
        'text-body-sm font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * Selectable chip — tag filters, weekday shortcuts, an empty state's next
 * step. Selected reads charcoal so it never competes with the green action.
 */
export function ChipButton({
  selected,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5',
        'text-body-sm font-medium transition-colors duration-150',
        selected
          ? 'border-transparent bg-ink text-surface'
          : 'border-hairline bg-surface text-ink hover:border-hairline-strong',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/**
 * Priority is never carried by color alone — docs/04-design-system.md §7.
 * The dot always travels with a label somewhere in the row.
 */
export function PriorityDot({
  priority,
  className,
}: {
  priority: 'high' | 'medium' | 'low'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        priority === 'high' && 'bg-priority-high',
        priority === 'medium' && 'bg-priority-medium',
        priority === 'low' && 'bg-priority-low',
        className,
      )}
    />
  )
}
