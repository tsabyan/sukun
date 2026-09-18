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

/** iOS switch, green when on. The row around it carries the 44px target. */
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
          'relative flex h-[30px] w-[50px] shrink-0 rounded-full p-[3px]',
          'transition-colors duration-200',
          checked ? 'bg-green' : 'bg-track',
        )}
      >
        {/* Transform-driven, not layout-measured: `x` animates every time,
            where Motion's `layout` prop silently snapped under Next 16. */}
        <motion.span
          initial={false}
          animate={{ x: checked ? 20 : 0 }}
          transition={spring.snappy}
          className="h-6 w-6 rounded-full bg-surface shadow-sm"
        />
      </span>
    </button>
  )
}
