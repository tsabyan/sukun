'use client'

import { motion } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'

export interface Segment<T extends string> {
  value: T
  label: string
  /** optional trailing count, e.g. "Active 8" */
  count?: number
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  'aria-label'?: string
}

/**
 * The iOS pill — docs/04-design-system.md §5.
 * Sunken track, raised thumb, thumb slides between segments via layoutId.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const count = segments.length
  const activeIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.value === value),
  )

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex w-full rounded-full bg-surface-sunken p-[3px]',
        className,
      )}
    >
      {/* One persistent thumb slid by transform. `x` is a percent of the
          thumb's own width, so it lands exactly on each segment — and it
          animates reliably where Motion's layoutId snapped under Next 16. */}
      <motion.span
        aria-hidden
        className="absolute inset-y-[3px] left-[3px] rounded-full bg-surface shadow-sm"
        style={{ width: `calc((100% - 6px) / ${count})` }}
        initial={false}
        animate={{ x: `${activeIndex * 100}%` }}
        transition={spring.snappy}
      />
      {segments.map((segment) => {
        const active = segment.value === value
        return (
          <button
            key={segment.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(segment.value)}
            className={cn(
              'relative z-10 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full',
              'text-label transition-colors duration-150',
              active ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            <span>{segment.label}</span>
            {segment.count !== undefined && (
              <span className={cn('tabular-nums', active ? 'text-ink-2' : 'text-ink-3')}>
                {segment.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
