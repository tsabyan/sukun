'use client'

import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  // one per screen, at most
  primary: 'bg-accent text-on-accent hover:brightness-105',
  secondary:
    'bg-surface-raised text-ink border border-hairline hover:border-hairline-strong',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-raised hover:text-ink',
  destructive: 'bg-transparent text-ember hover:bg-ember/10',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 rounded-[10px] text-label',
  md: 'h-11 px-4 rounded-md text-label',
}

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  children?: React.ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={spring.snappy}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-medium',
        'transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-[0.38]',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}

/**
 * Square icon button. 44px is the iOS touch target and it is not negotiable —
 * docs/04-design-system.md §7.
 */
export function IconButton({
  variant = 'ghost',
  size = 44,
  label,
  className,
  disabled,
  children,
  ...props
}: Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: ButtonVariant
  size?: number
  label: string
  children?: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={spring.snappy}
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-[0.38]',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}
