'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The green card at the top of every screen — docs/04-design-system.md §5.
 *
 * One per screen, always the first thing under the header, and always the
 * number that screen is about: today's progress on Home, open tasks on Tasks,
 * hours focused on Insights, habits done on Habits. Everything on it is
 * charcoal: #292A2C on --green measures 7.6:1.
 */
export function HeroCard({
  title,
  chip,
  value,
  sub,
  children,
  className,
}: {
  title: string
  /** quiet charcoal pill on the right of the title row */
  chip?: ReactNode
  /** the number, rendered light and large */
  value: ReactNode
  /** one line under the number */
  sub?: ReactNode
  /** bars, mini stats, a progress track — whatever the screen needs */
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-xl bg-green p-4 text-ink',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-title-s">{title}</h2>
        {chip ? <div className="flex shrink-0 items-center gap-2">{chip}</div> : null}
      </div>

      <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
        <p className="numerals text-display-m">{value}</p>
        {sub ? <p className="pb-1 text-body-sm">{sub}</p> : null}
      </div>

      {children}
    </section>
  )
}

/** Small translucent panels inside the hero — up to three across. */
export function HeroStats({
  items,
}: {
  items: ReadonlyArray<{ value: string; label: string }>
}) {
  return (
    <div className="flex gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="on-hero flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm px-3 py-2.5"
        >
          <span className="numerals text-title-m font-light">{item.value}</span>
          <span className="text-[11px] leading-tight">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Seven bars, one per weekday, inside the hero. Values are 0–1; anything at
 * zero still draws a stub so the week reads as a week rather than a gap.
 */
export function HeroWeekBars({
  values,
  labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}: {
  values: readonly number[]
  labels?: readonly string[]
}) {
  return (
    <div className="flex h-20 items-end gap-2.5">
      {labels.map((label, i) => {
        const value = values[i] ?? 0
        return (
          <div key={`${label}-${i}`} className="flex h-full flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-full',
                  value > 0 ? 'on-hero-strong' : 'on-hero',
                )}
                style={{ height: `${Math.max(8, Math.round(value * 100))}%` }}
              />
            </div>
            <span className="text-[10px] leading-none">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
