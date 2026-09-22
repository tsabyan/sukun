import { cn } from '@/lib/utils/cn'

/**
 * The Ajeg mascot — docs/04-design-system.md §0.1.
 *
 * The app has one logo and this is it: the charcoal sprout that sits on the
 * home screen. There is no second, abstract mark for in-app use. A product
 * this size cannot afford two identities, and the icon is the one people
 * actually learn.
 *
 * Six expressions ship. They are the same character, so the brand is never
 * diluted by picking one — a screen that explains a problem gets `surprised`,
 * a screen that is waiting gets `resting`, everything else gets `normal`.
 *
 * The character is charcoal and does not re-tint, so it is always served on a
 * cream disc — `--brand-ground`, the icon art's own field, constant in both
 * themes. Without it the mascot is invisible in dark mode, where the canvas
 * and every surface token are darker than the character. A green disc was
 * tried first and swallowed the sprout.
 *
 * Raster, not SVG, and deliberately a plain `<img>`: the file is ~5KB, it is
 * precached with `public/images/mascot/`, and it must render on the offline
 * screen, where the `/_next/image` optimiser is not reachable.
 */

export const MOODS = [
  'normal',
  'thinking',
  'resting',
  'surprised',
  'happy',
  'cheering',
] as const

export type Mood = (typeof MOODS)[number]

/** The character's share of the disc. The rest is the ground it stands on. */
const FILL = 0.76

export function Mascot({
  size = 32,
  mood = 'normal',
  alt = '',
  className,
  ...props
}: {
  size?: number
  mood?: Mood
  /** Empty by default: the mascot decorates a heading that already says it. */
  alt?: string
  className?: string
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'className'>) {
  const inner = Math.round(size * FILL)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-ground',
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {/* A plain <img>, not next/image: this must resolve from the precache
          while offline, where /_next/image is unreachable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/mascot/${mood}.png`}
        width={inner}
        height={inner}
        alt={alt}
        aria-hidden={alt === '' ? true : undefined}
        draggable={false}
        className="select-none"
      />
    </span>
  )
}

/**
 * Mascot + wordmark lockup. Lowercase because it is an everyday word and an
 * even, unshouted line is the point of it.
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
      <Mascot size={size * 1.7} />
      <span
        className="font-display lowercase"
        style={{
          fontSize: size,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          fontVariationSettings: '"wdth" 112',
        }}
      >
        ajeg
      </span>
    </span>
  )
}
