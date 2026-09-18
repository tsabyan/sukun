'use client'

import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  /** adds hover elevation and a press response */
  interactive?: boolean
  padding?: 'compact' | 'default' | 'list' | 'none'
  children?: React.ReactNode
  /** React 19 takes ref as an ordinary prop — drop targets need it */
  ref?: React.Ref<HTMLDivElement>
}

const PADDING = {
  compact: 'p-3.5',
  default: 'p-4',
  /** rows supply their own vertical padding, the card only insets them */
  list: 'px-4 py-0.5',
  none: '',
} as const

/**
 * White, soft-cornered, barely lifted — docs/04-design-system.md §5.
 * No border: on a grey canvas the shadow is enough, and a hairline plus a
 * shadow reads as two edges.
 */
export function Card({
  interactive,
  padding = 'default',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      whileTap={interactive ? { scale: 0.99 } : undefined}
      transition={spring.snappy}
      className={cn(
        'rounded-lg bg-surface shadow-md',
        PADDING[padding],
        interactive && 'cursor-pointer transition-shadow duration-200 hover:shadow-lg',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/** Section eyebrow above a card or list. */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={cn('eyebrow mb-2 px-1 text-ink-3', className)}>{children}</p>
}

/**
 * Card header: title on the left, and on the right either a quiet chip, a
 * small "+" for the list the card owns, or both. The "+" lives here rather
 * than in the page header so the thumb never travels to a corner.
 */
export function CardHead({
  title,
  children,
  className,
}: {
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="truncate text-title-s text-ink">{title}</h2>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  )
}
