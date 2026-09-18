'use client'

import { cn } from '@/lib/utils/cn'
import type { BreakdownSlice } from '@/lib/stats/insights'

/**
 * "Where focus went" — E1.
 *
 * Circles, not a pie: a pie asks you to compare angles, and the only question
 * here is which one is biggest. Area is proportional to share, so the widths
 * come from the square root; they are then normalised to the row so three
 * slices or one always fill the card the same way.
 */
const TONES = [
  { fill: 'bg-green', text: 'text-ink' },
  { fill: 'bg-green-mid', text: 'text-ink' },
  { fill: 'bg-ink', text: 'text-surface' },
  { fill: 'bg-green-soft', text: 'text-green-deep' },
] as const

/** Percent of the row's width given over to the gaps between bubbles. */
const GAP_SHARE = 4

export function FocusBubbles({ slices }: { slices: BreakdownSlice[] }) {
  const roots = slices.map((slice) => Math.sqrt(slice.share))
  const sum = roots.reduce((total, root) => total + root, 0) || 1
  const available = 100 - GAP_SHARE * Math.max(0, slices.length - 1)

  return (
    <ul className="flex items-center justify-center gap-[4%]">
      {slices.map((slice, i) => {
        const tone = TONES[Math.min(i, TONES.length - 1)]
        return (
          <li
            key={slice.name}
            title={`${slice.name}: ${slice.share}%`}
            style={{ width: `${(roots[i] / sum) * available}%` }}
            className={cn(
              'flex aspect-square min-w-0 flex-col items-center justify-center rounded-full',
              tone.fill,
              tone.text,
            )}
          >
            <span className="numerals text-title-m leading-none">{slice.share}%</span>
            <span className="max-w-full truncate px-2 pt-1 text-[11px] leading-none">
              {slice.name}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
