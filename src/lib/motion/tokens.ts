import type { Transition } from 'motion/react'

/**
 * Motion tokens — docs/04-design-system.md §4.
 * iOS motion is spring-based. Nothing here is a linear ease except the
 * progress ring, which is genuinely linear time and handles its own timing.
 */

export const spring = {
  /** buttons, toggles, chips */
  snappy: { type: 'spring', stiffness: 400, damping: 34, mass: 0.9 },
  /** sheets, layout shifts */
  smooth: { type: 'spring', stiffness: 260, damping: 30 },
  /** ring, ambient, phase change */
  gentle: { type: 'spring', stiffness: 160, damping: 26 },
} satisfies Record<string, Transition>

export const ease = {
  /** the iOS sheet presentation curve */
  ios: [0.32, 0.72, 0, 1],
  out: [0.16, 1, 0.3, 1],
} as const

export const dur = {
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  ambient: 0.48,
} as const

/** Press feedback shared by every interactive surface. */
export const press = {
  whileTap: { scale: 0.97 },
  transition: spring.snappy,
} as const
