'use client'

import { useEffect } from 'react'

/**
 * The Daylight canvas — docs/04-design-system.md §0 and §1.
 *
 * A near-invisible tint that shifts across the day: cool before dawn, flat at
 * midday, warm at dusk, deep blue at night. Under 8% opacity, so it is never
 * consciously seen — but the app at 9am and the app at 11pm do not feel the
 * same. Ties the timer to the planner's Morning / Afternoon / Evening buckets.
 *
 * The initial value is set by the blocking script in <head>; this component
 * only keeps it current as the hour rolls over.
 */

export type DaylightBand = 'dawn' | 'day' | 'dusk' | 'night'

export const DAYLIGHT_TINTS: Record<DaylightBand, string> = {
  dawn: 'rgb(74 92 138 / 0.07)',
  day: 'rgb(120 140 160 / 0.03)',
  dusk: 'rgb(150 108 92 / 0.07)',
  night: 'rgb(38 54 96 / 0.09)',
}

export function daylightBand(hour: number): DaylightBand {
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 16) return 'day'
  if (hour >= 16 && hour < 20) return 'dusk'
  return 'night'
}

export function DaylightLayer() {
  useEffect(() => {
    const apply = () => {
      const tint = DAYLIGHT_TINTS[daylightBand(new Date().getHours())]
      document.documentElement.style.setProperty('--daylight-tint', tint)
    }

    apply()

    // Re-check on the hour rather than on an interval that drifts.
    let timeout: ReturnType<typeof setTimeout>
    const scheduleNextHour = () => {
      const now = new Date()
      const msToNextHour =
        (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds()
      timeout = setTimeout(() => {
        apply()
        scheduleNextHour()
      }, msToNextHour + 500)
    }
    scheduleNextHour()

    // A backgrounded tab's timeout can be throttled past the hour boundary.
    const onVisible = () => {
      if (document.visibilityState === 'visible') apply()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'radial-gradient(120% 80% at 50% 0%, var(--daylight-tint), transparent 70%)',
        transition: 'background 4s linear',
      }}
    />
  )
}
