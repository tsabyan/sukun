'use client'

import { motion } from 'motion/react'
import { fromLocalDate, formatDuration } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'
import type { HeatmapCell } from '@/lib/db/types'

/**
 * Five discrete steps, not one colour at five opacities — docs/04 §5. The top
 * step is charcoal so a heavy day still reads at a glance on the grey canvas.
 */
const LEVEL_FILL = [
  'bg-track',
  'bg-green-soft',
  'bg-green-mid',
  'bg-green',
  'bg-ink',
] as const

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface HeatmapProps {
  cells: HeatmapCell[]
  weekStartsOn: number
  onSelect: (cell: HeatmapCell) => void
}

/**
 * Twelve weeks by seven days, hand-rolled — docs/05-screens.md E1.
 *
 * A chart library is forty kilobytes for eighty-four rectangles. Columns are
 * weeks and rows are weekdays, both flexible, so the grid fills whatever width
 * the card has instead of scrolling sideways on a narrow phone.
 */
export function Heatmap({ cells, weekStartsOn, onSelect }: HeatmapProps) {
  const weeks = Math.ceil(cells.length / 7)

  // Row labels follow the configured week start, so a Sunday-start user does
  // not read Monday against their Sunday row.
  const labels = Array.from(
    { length: 7 },
    (_, i) => DAY_LABELS[(i + (weekStartsOn === 0 ? 6 : 0)) % 7],
  )

  return (
    <div className="flex gap-2">
      <div className="flex shrink-0 flex-col gap-1.5" aria-hidden>
        {labels.map((label, i) => (
          <span
            key={i}
            className="flex h-3.5 w-2.5 items-center text-[9px] font-medium leading-none text-ink-3"
          >
            {label}
          </span>
        ))}
      </div>

      <div
        className="flex min-w-0 flex-1 flex-col gap-1.5"
        role="img"
        aria-label={`Focus activity over the last ${weeks} weeks`}
      >
        {labels.map((_, row) => (
          <div key={row} className="flex gap-1.5">
            {Array.from({ length: weeks }, (_, column) => {
              const cell = cells[column * 7 + row]
              if (!cell) return <span key={column} className="h-3.5 min-w-0 flex-1" />
              return <Cell key={cell.date} cell={cell} column={column} onSelect={onSelect} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function Cell({
  cell,
  column,
  onSelect,
}: {
  cell: HeatmapCell
  column: number
  onSelect: (cell: HeatmapCell) => void
}) {
  const date = fromLocalDate(cell.date)
  const label = `${date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}: ${
    cell.sessions === 0
      ? 'no sessions'
      : `${cell.sessions} ${cell.sessions === 1 ? 'session' : 'sessions'}, ${formatDuration(cell.focusSeconds)}`
  }`

  return (
    <motion.button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => onSelect(cell)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: column * 0.008 }}
      className={cn('h-3.5 min-w-0 flex-1 rounded-[4px]', LEVEL_FILL[cell.level])}
    />
  )
}

/** The scale, and the span it covers. */
export function HeatmapLegend({ span }: { span?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[10px] text-ink-3">
      <span className="flex items-center gap-1.5">
        <span>Less</span>
        {LEVEL_FILL.map((fill, level) => (
          <span key={level} className={cn('block size-2.5 rounded-[3px]', fill)} />
        ))}
        <span>More</span>
      </span>
      {span ? <span className="shrink-0 tabular-nums">{span}</span> : null}
    </div>
  )
}
