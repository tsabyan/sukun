'use client'

import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  /** adds hover elevation and a press response */
  interactive?: boolean
  padding?: 'compact' | 'default' | 'none'
  children?: React.ReactNode
}

const PADDING = {
  compact: 'p-4',
  default: 'p-5',
  none: '',
} as const

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
        'rounded-lg border border-hairline bg-surface shadow-sm',
        PADDING[padding],
        interactive &&
          'cursor-pointer transition-[box-shadow,border-color] duration-200 hover:border-hairline-strong hover:shadow-md',
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
  return (
    <p className={cn('eyebrow mb-3 px-1 text-ink-3', className)}>{children}</p>
  )
}
