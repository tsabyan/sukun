'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label: string
  suffix?: string
  className?: string
}

/** Two taps beat a number keyboard for a value that lives between 0 and 10. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 50,
  label,
  suffix,
  className,
}: StepperProps) {
  const clamp = (next: number) => onChange(Math.min(max, Math.max(min, next)))

  return (
    <div
      className={cn(
        'inline-flex h-11 items-center gap-1 rounded-md border border-hairline bg-surface-sunken px-1',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => clamp(value - 1)}
        className="inline-flex size-9 items-center justify-center rounded-[10px] text-ink-2 transition-colors hover:text-ink disabled:opacity-[0.38]"
      >
        <Minus size={16} strokeWidth={2} />
      </button>

      <span className="min-w-[4.5ch] text-center text-body tabular-nums text-ink">
        {value}
        {suffix && <span className="ml-1 text-body-sm text-ink-3">{suffix}</span>}
      </span>

      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => clamp(value + 1)}
        className="inline-flex size-9 items-center justify-center rounded-[10px] text-ink-2 transition-colors hover:text-ink disabled:opacity-[0.38]"
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
