'use client'

import { motion } from 'motion/react'
import { fromLocalDate } from '@/lib/utils/dates'
import { formatDuration } from '@/lib/utils/dates'
import type { HeatmapCell } from '@/lib/db/types'

const CELL = 12
const GAP = 3
const STEP = CELL + GAP

/** Level 0 is a well; 1–4 are the accent at rising opacity. */
const LEVEL_OPACITY = [0, 0.08, 0.28, 0.48, 0.7, 1] as const

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

interface HeatmapProps {
  cells: HeatmapCell[]
  weekStartsOn: number
  onSelect: (cell: HeatmapCell) => void
}

/**
 * Twelve weeks by seven days, hand-rolled — docs/05-screens.md S7.
 *
 * A chart library is forty kilobytes for eighty-four rectangles. Cells stagger
 * in by column once on mount and never animate again; a grid that re-animates
 * on every render is noise.
 */
export function Heatmap({ cells, weekStartsOn, onSelect }: HeatmapProps) {
  const weeks = Math.ceil(cells.length / 7)
  const width = weeks * STEP
  const height = 7 * STEP

  // Row labels follow the configured week start, so a Sunday-start user does
  // not read Monday against their Sunday column.
  const labels = Array.from(
    { length: 7 },
    (_, i) => DAY_LABELS[(i + (weekStartsOn === 0 ? 6 : 0)) % 7],
  )

  return (
    <div className="flex gap-2">
      <div
        className="flex shrink-0 flex-col justify-between py-[1px]"
        style={{ height }}
        aria-hidden
      >
        {labels.map((label, i) => (
          <span key={i} className="eyebrow leading-none text-ink-3" style={{ height: CELL }}>
            {label}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Focus activity over the last ${weeks} weeks`}
        >
          {cells.map((cell, index) => {
            const column = Math.floor(index / 7)
            const row = index % 7
            const date = fromLocalDate(cell.date)

            return (
              <motion.rect
                key={cell.date}
                x={column * STEP}
                y={row * STEP}
                width={CELL}
                height={CELL}
                rx={3}
                fill={cell.level === 0 ? 'var(--surface-sunken)' : 'var(--accent)'}
                fillOpacity={cell.level === 0 ? 1 : LEVEL_OPACITY[cell.level]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: column * 0.008 }}
                onClick={() => onSelect(cell)}
                className="cursor-pointer outline-none focus-visible:stroke-[var(--accent)] focus-visible:stroke-2"
                tabIndex={0}
                role="button"
              >
                {/* colour never carries meaning alone — docs/04 §7 */}
                <title>
                  {date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {': '}
                  {cell.sessions === 0
                    ? 'no sessions'
                    : `${cell.sessions} ${cell.sessions === 1 ? 'session' : 'sessions'}, ${formatDuration(cell.focusSeconds)}`}
                </title>
              </motion.rect>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-body-sm text-ink-3">
      <span>Less</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className="block size-3 rounded-[3px]"
          style={{
            background: level === 0 ? 'var(--surface-sunken)' : 'var(--accent)',
            opacity: level === 0 ? 1 : LEVEL_OPACITY[level],
          }}
        />
      ))}
      <span>More</span>
    </div>
  )
}
