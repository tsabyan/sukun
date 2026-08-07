'use client'

import { motion } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  /** hide the label visually but keep it for screen readers */
  hideLabel?: boolean
  className?: string
}

/** iOS switch. 51×31 is the platform size; anything smaller misses on touch. */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hideLabel = true,
  className,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex items-center gap-3',
        disabled && 'pointer-events-none opacity-[0.38]',
        className,
      )}
    >
      {!hideLabel && <span className="text-body text-ink">{label}</span>}
      <span
        className={cn(
          'relative flex h-[31px] w-[51px] shrink-0 rounded-full p-[2px]',
          'transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-sunken border border-hairline',
        )}
      >
        {/* Transform-driven, not layout-measured: `x` animates every time,
            where Motion's `layout` prop silently snapped under Next 16. */}
        <motion.span
          initial={false}
          animate={{ x: checked ? 20 : 0 }}
          transition={spring.snappy}
          className="h-[27px] w-[27px] rounded-full bg-white shadow-md"
        />
      </span>
    </button>
  )
}
