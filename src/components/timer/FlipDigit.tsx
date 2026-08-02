'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * One split-flap card — docs/05-screens.md S3.
 *
 * The top half falls away as the incoming bottom half rises to meet it, both
 * on rotateX with a shared perspective. The 1px seam across the middle is what
 * sells the whole thing as a physical object; without it the card reads as a
 * number that happens to spin.
 *
 * Only digits that actually change animate — the tens-of-minutes card sits
 * still for ten minutes at a time, and re-flipping it every second would be
 * both wrong and expensive.
 */

interface FlipDigitProps {
  value: string
  /** disables the flip entirely for prefers-reduced-motion */
  animate: boolean
}

const DURATION_MS = 380

export function FlipDigit({ value, animate }: FlipDigitProps) {
  // Track the outgoing digit so both halves can be drawn mid-flip. Adjusted
  // during render rather than in an effect, which would show one stale frame.
  const [shown, setShown] = useState(value)
  const [previous, setPrevious] = useState(value)
  const [flipKey, setFlipKey] = useState(0)

  if (value !== shown) {
    setPrevious(shown)
    setShown(value)
    setFlipKey((k) => k + 1)
  }

  const flipping = animate && previous !== shown

  return (
    <span
      className="relative block select-none"
      style={{ perspective: '800px' }}
      aria-hidden
    >
      <span className="relative block overflow-hidden rounded-[0.12em] bg-surface-raised">
        {/* static face */}
        <Face digit={shown} />

        {/* seam */}
        <span
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-canvas/70"
          style={{ zIndex: 3 }}
        />

        {flipping && (
          <span key={flipKey} className="pointer-events-none absolute inset-0" style={{ zIndex: 2 }}>
            {/* outgoing top half falls forward */}
            <span
              className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-surface-raised"
              style={{
                transformOrigin: 'bottom',
                transformStyle: 'preserve-3d',
                animation: `sukun-flip-top ${DURATION_MS}ms cubic-bezier(0.36, 0, 0.66, -0.2) forwards`,
              }}
            >
              <Face digit={previous} half="top" />
              <span className="absolute inset-0 bg-black/0" style={{ animation: `sukun-flip-shade ${DURATION_MS}ms linear forwards` }} />
            </span>

            {/* incoming bottom half rises to meet it */}
            <span
              className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-surface-raised"
              style={{
                transformOrigin: 'top',
                transformStyle: 'preserve-3d',
                animation: `sukun-flip-bottom ${DURATION_MS}ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards`,
              }}
            >
              <Face digit={shown} half="bottom" />
            </span>
          </span>
        )}
      </span>
    </span>
  )
}

/**
 * A half is the whole glyph, clipped. Rendering half a number any other way
 * puts the cut in a different place at every font size.
 */
function Face({ digit, half }: { digit: string; half?: 'top' | 'bottom' }) {
  return (
    <span
      className={cn(
        'flex items-center justify-center tabular-nums text-ink',
        half === undefined && 'relative',
      )}
      style={{
        fontFamily: 'var(--font-display)',
        fontVariationSettings: '"wdth" 112',
        fontWeight: 600,
        lineHeight: 1,
        width: '0.68em',
        height: '1em',
        // Each half is the full glyph, clipped by its container: the top box
        // shows its upper portion, the bottom box its lower.
        ...(half === 'top' ? { position: 'absolute' as const, top: 0 } : {}),
        ...(half === 'bottom' ? { position: 'absolute' as const, bottom: 0 } : {}),
      }}
    >
      {digit}
    </span>
  )
}
