'use client'

import { motion } from 'motion/react'
import type { MonthlyBar } from '@/lib/stats/aggregate'

const HEIGHT = 120
const BAR_RADIUS = 4

/**
 * Six months of session counts. Hand-rolled SVG for the same reason as the
 * heatmap: this is a dozen rectangles and an axis.
 *
 * The current month sits at full opacity and the rest at 70%, so "where am I
 * now" reads without a legend.
 */
export function BarChart({ bars }: { bars: MonthlyBar[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.sessions))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2" style={{ height: HEIGHT }}>
        {bars.map((bar, index) => {
          const ratio = bar.sessions / max
          const isCurrent = index === bars.length - 1

          return (
            <div key={bar.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(ratio * 100, bar.sessions > 0 ? 4 : 1.5)}%` }}
                transition={{ duration: 0.4, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                style={{ borderRadius: BAR_RADIUS }}
                className={
                  bar.sessions > 0
                    ? isCurrent
                      ? 'bg-accent'
                      : 'bg-accent/70'
                    : 'bg-hairline'
                }
                title={`${bar.label}: ${bar.sessions} sessions`}
              />
            </div>
          )
        })}
      </div>

      <div className="flex gap-2" aria-hidden>
        {bars.map((bar) => (
          <span key={bar.key} className="eyebrow flex-1 text-center text-ink-3">
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  )
}
