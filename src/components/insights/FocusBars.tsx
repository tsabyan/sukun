'use client'

import { cn } from '@/lib/utils/cn'
import { formatDuration } from '@/lib/utils/dates'
import type { BreakdownSlice } from '@/lib/stats/insights'

/**
 * "Where focus went" — E1.
 *
 * Horizontal bars against a fixed 0–100% axis, not a pie and not circles: the
 * question is which tag took the most, and lengths off a shared baseline are
 * the one comparison the eye does accurately. The axis runs to 100 rather than
 * to the largest slice, so a 51% week never looks like a full bar.
 *
 * Flat fills, four steps of the brand scale by rank. No gradients — a gradient
 * across a bar makes its end ambiguous, which is the only part being read.
 */
const TONES = ['bg-green', 'bg-green-mid', 'bg-ink', 'bg-green-soft'] as const

const TICKS = [0, 25, 50, 75, 100]

/** Enough bar to be seen at 1%, so a tiny slice reads as small, not as absent. */
const MIN_BAR = 6

export function FocusBars({ slices }: { slices: BreakdownSlice[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-col gap-2">
        {slices.map((slice, i) => (
          <li key={slice.name} className="flex items-center gap-3">
            <span
              className="w-[84px] shrink-0 truncate text-body text-ink"
              title={`${slice.name} · ${formatDuration(slice.focusSeconds)}`}
            >
              {slice.name}
            </span>

            <span className="relative h-7 min-w-0 flex-1">
              <span
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full',
                  TONES[Math.min(i, TONES.length - 1)],
                )}
                style={{ width: `max(${MIN_BAR}px, ${slice.share}%)` }}
              />
            </span>

            <span className="numerals w-9 shrink-0 text-right text-body-sm text-ink-2">
              {slice.share}%
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="w-[84px] shrink-0" />
        <span className="flex min-w-0 flex-1 justify-between">
          {TICKS.map((tick) => (
            <span key={tick} className="numerals text-[10px] text-ink-3">
              {tick}%
            </span>
          ))}
        </span>
        <span className="w-9 shrink-0" />
      </div>
    </div>
  )
}
