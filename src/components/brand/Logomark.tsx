import { cn } from '@/lib/utils/cn'

/**
 * The Sukun mark — docs/04-design-system.md §0.1.
 *
 * A stroked circle with a 40° gap opening at the top-right. One shape, three
 * readings: the sukun diacritic ( ـْ ), a progress ring mid-session, and a day
 * that isn't finished.
 *
 * Stroke is currentColor, so wrapping it in `text-accent` makes it retint with
 * the timer phase for free.
 */

const R = 9
const CIRCUMFERENCE = 2 * Math.PI * R
const GAP_DEGREES = 40
const GAP = (CIRCUMFERENCE * GAP_DEGREES) / 360
const ARC = CIRCUMFERENCE - GAP

// -90° puts the origin at 12 o'clock; +40° starts the stroke after the gap.
const ROTATION = -90 + GAP_DEGREES

export function Logomark({
  size = 24,
  className,
  ...props
}: { size?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Sukun"
      className={cn('shrink-0', className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r={R}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${ARC} ${GAP}`}
        transform={`rotate(${ROTATION} 12 12)`}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Mark + wordmark lockup. Lowercase because the word means quiet — small caps
 * would be shouting.
 */
export function Wordmark({
  size = 20,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-ink', className)}>
      <Logomark size={size * 1.2} className="text-accent" />
      <span
        className="font-display lowercase"
        style={{
          fontSize: size,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          fontVariationSettings: '"wdth" 112',
        }}
      >
        sukun
      </span>
    </span>
  )
}
