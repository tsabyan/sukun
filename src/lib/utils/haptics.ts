/**
 * Haptics — docs/04-design-system.md §4.
 * Only these three moments vibrate. Anything more reads as a toy.
 */

type Pattern = 'phaseComplete' | 'taskComplete' | 'dragEngaged'

const PATTERNS: Record<Pattern, number | number[]> = {
  phaseComplete: [18, 40, 18],
  taskComplete: 12,
  dragEngaged: 8,
}

// Mirrored from settings rather than read from the store: haptics fire inside
// gesture handlers, where an async lookup would land after the moment passed.
let enabled = true

export function setHapticsEnabled(next: boolean) {
  enabled = next
}

export function haptic(pattern: Pattern) {
  if (!enabled) return
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  navigator.vibrate(PATTERNS[pattern])
}
