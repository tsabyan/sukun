'use client'

import { useEffect, useRef } from 'react'
import { remainingMs } from '@/lib/timer/machine'
import { useTimerStore } from '@/lib/timer/store'

/**
 * The countdown ring — docs/04-design-system.md §5.
 *
 * The arc depletes: full circle at the start, nothing left at zero. Same shape
 * as the logomark, which is a ring that hasn't closed.
 *
 * Driven by a single requestAnimationFrame loop writing straight to the DOM,
 * never through React state. At 60fps a state-driven ring would re-render the
 * whole screen sixty times a second to move one line; this moves one attribute
 * and touches nothing else. The loop only runs while the timer is running —
 * a paused or idle ring is a static value, set once.
 *
 * No glow. The reference app's bloom is the loudest thing on its screen; here
 * a 10px line is enough.
 */

const STROKE = 10
const VIEWBOX = 320
const RADIUS = (VIEWBOX - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ProgressRing({ children }: { children?: React.ReactNode }) {
  const arcRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    let frame = 0

    const paint = () => {
      const arc = arcRef.current
      if (!arc) return

      const { runtime } = useTimerStore.getState()
      const total = runtime.plannedDurationSec * 1000

      // Read the clock directly rather than the store's remainingMs: the store
      // only updates on the 250ms tick, and the ring should be smooth.
      const elapsed = total > 0 ? 1 - remainingMs(runtime, Date.now()) / total : 0
      const fraction = Math.min(1, Math.max(0, elapsed))

      arc.style.strokeDashoffset = String(CIRCUMFERENCE * fraction)
    }

    const loop = () => {
      paint()
      frame = requestAnimationFrame(loop)
    }

    const sync = (status: string) => {
      cancelAnimationFrame(frame)
      frame = 0
      if (status === 'running') loop()
      else paint()
    }

    sync(useTimerStore.getState().runtime.status)

    const unsubscribe = useTimerStore.subscribe((state, previous) => {
      if (
        state.runtime.status !== previous.runtime.status ||
        state.runtime.endsAt !== previous.runtime.endsAt ||
        state.hydrated !== previous.hydrated
      ) {
        sync(state.runtime.status)
      }
    })

    return () => {
      cancelAnimationFrame(frame)
      unsubscribe()
    }
  }, [])

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px] lg:max-w-[320px]">
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="size-full -rotate-90"
        aria-hidden
      >
        <circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={STROKE}
        />
        <circle
          ref={arcRef}
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={0}
          style={{ transition: 'stroke 480ms var(--ease-out)' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-10 text-center">
        {children}
      </div>
    </div>
  )
}
