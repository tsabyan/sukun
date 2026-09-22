'use client'

import { useEffect, useRef } from 'react'
import { Sheet } from './Sheet'
import { Button } from './Button'
import { cn } from '@/lib/utils/cn'

const ROW = 48
const VISIBLE = 5
const HEIGHT = ROW * VISIBLE

interface WheelPickerSheetProps {
  open: boolean
  onClose: () => void
  title: string
  values: number[]
  value: number
  suffix?: string
  onChange: (value: number) => void
}

/**
 * A scroll-snap wheel, not a number input — docs/05-screens.md F2.
 *
 * Durations are picked from a short list of sensible values, and a numeric
 * keyboard for "25" is both slower and an invitation to type 250. Snapping is
 * native CSS; the component only reads back where the scroll came to rest.
 */
export function WheelPickerSheet({
  open,
  onClose,
  title,
  values,
  value,
  suffix,
  onChange,
}: WheelPickerSheetProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Centre the current value whenever the sheet opens.
  useEffect(() => {
    if (!open) return
    const index = Math.max(0, values.indexOf(value))
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: index * ROW, behavior: 'instant' as ScrollBehavior })
    })
    return () => cancelAnimationFrame(id)
  }, [open, value, values])

  const commitFromScroll = () => {
    const element = listRef.current
    if (!element) return
    const index = Math.round(element.scrollTop / ROW)
    const next = values[Math.min(values.length - 1, Math.max(0, index))]
    if (next !== undefined && next !== value) onChange(next)
  }

  const handleScroll = () => {
    // `scrollend` is not everywhere yet, so fall back to a short quiet period.
    if (settle.current) clearTimeout(settle.current)
    settle.current = setTimeout(commitFromScroll, 120)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      snapPoints={[0.9]}
      action={
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="relative" style={{ height: HEIGHT }}>
        {/* The selected row sits in this band. Charcoal rather than a sunken
            well — the value is the one thing on this sheet, and a grey band on
            a white sheet did not read as a selection at all. Issue #8. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 rounded-full bg-on-accent"
          style={{ height: ROW }}
        />

        <div
          ref={listRef}
          onScroll={handleScroll}
          role="listbox"
          aria-label={title}
          tabIndex={0}
          className="relative z-10 h-full snap-y snap-mandatory overflow-y-auto"
          style={{ scrollbarWidth: 'none', paddingBlock: (HEIGHT - ROW) / 2 }}
        >
          {values.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onClick={() => onChange(option)}
              className={cn(
                'flex w-full snap-center items-center justify-center gap-1.5 transition-colors',
                'numerals',
                option === value
                  ? 'text-title-l font-normal text-green'
                  : 'text-title-m text-ink-3',
              )}
              style={{ height: ROW }}
            >
              {option}
              {suffix && (
                <span
                  className={cn(
                    'text-body-sm',
                    option === value ? 'text-green/70' : 'text-ink-3',
                  )}
                >
                  {suffix}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
