'use client'

import { cn } from '@/lib/utils/cn'

type PillTone = 'neutral' | 'accent' | 'high' | 'medium' | 'low'

const TONES: Record<PillTone, string> = {
  neutral: 'bg-surface-sunken text-ink-2 border-hairline',
  accent: 'accent-muted text-accent border-transparent',
  high: 'bg-priority-high/12 text-priority-high border-transparent',
  medium: 'bg-priority-medium/12 text-priority-medium border-transparent',
  low: 'bg-priority-low/12 text-priority-low border-transparent',
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
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
 * Selectable chip — tag filters, weekday pickers.
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
        'text-label transition-colors duration-150',
        selected
          ? 'accent-muted border-transparent text-accent'
          : 'border-hairline bg-surface text-ink-2 hover:border-hairline-strong hover:text-ink',
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
