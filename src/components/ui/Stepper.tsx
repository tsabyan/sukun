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
        'inline-flex h-12 items-center rounded-full bg-field p-1',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => clamp(value - 1)}
        className="inline-flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-sm transition-colors disabled:bg-transparent disabled:text-ink-3 disabled:shadow-none"
      >
        <Minus size={16} strokeWidth={2} />
      </button>

      <span className="min-w-[3.5ch] text-center text-title-s tabular-nums text-ink">
        {value}
        {suffix && <span className="ml-1 text-body-sm text-ink-3">{suffix}</span>}
      </span>

      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => clamp(value + 1)}
        className="inline-flex size-10 items-center justify-center rounded-full bg-ink text-lime transition-colors disabled:bg-transparent disabled:text-ink-3"
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
