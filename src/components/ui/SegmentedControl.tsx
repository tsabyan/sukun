'use client'

import { useId } from 'react'
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
  const layoutId = useId()

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex w-full gap-1 rounded-full bg-surface-sunken p-[3px]',
        className,
      )}
    >
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
              'relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full',
              'text-label transition-colors duration-150',
              active ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-full bg-surface shadow-sm"
              />
            )}
            <span className="relative z-10">{segment.label}</span>
            {segment.count !== undefined && (
              <span
                className={cn(
                  'relative z-10 tabular-nums',
                  active ? 'text-ink-2' : 'text-ink-3',
                )}
              >
                {segment.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
