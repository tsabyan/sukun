'use client'

import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  // The primary action is charcoal, not green: green is the brand colour and
  // it is everywhere, so a green button stops reading as "press this".
  primary: 'bg-ink text-surface hover:brightness-125',
  // Reserved for the one place the brand colour *is* the action: the bottom
  // bar's page action, and confirmations inside a lime sheet.
  accent: 'bg-green text-on-accent hover:brightness-105',
  secondary: 'bg-surface text-ink border border-hairline hover:border-hairline-strong',
  ghost: 'bg-transparent text-ink-2 hover:bg-field hover:text-ink',
  destructive: 'bg-ember text-surface hover:brightness-105',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-label',
  md: 'h-12 px-5 text-label',
  lg: 'h-13 px-6 text-title-s',
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
        // Capsules throughout — docs/04-design-system.md §3.
        'inline-flex select-none items-center justify-center gap-2 rounded-full font-medium',
        'transition-[filter,background-color,border-color] duration-150',
        'disabled:pointer-events-none disabled:bg-track disabled:text-ink-3',
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
 * Round icon button — the header gear, the timer controls, the little "+" in a
 * card header. 44px is the iOS touch target and it is not negotiable, so the
 * smaller sizes below it are only for controls that sit inside a 44px row.
 */
export function IconButton({
  variant = 'secondary',
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
        'transition-[filter,background-color,border-color] duration-150',
        'disabled:pointer-events-none disabled:bg-track disabled:text-ink-3',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}
