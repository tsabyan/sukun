import { PHASE_STORAGE_KEY, THEME_STORAGE_KEY } from './script'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type Phase = 'focus' | 'short_break' | 'long_break'

/**
 * Theme lives on the <html> element, not in React state.
 *
 * The blocking script in <head> sets data-theme and data-phase before first
 * paint, so the DOM is already correct by the time React hydrates. Treating it
 * as an external store — rather than copying it into state inside an effect —
 * avoids a cascading render and keeps one source of truth.
 */

type Listener = () => void
const listeners = new Set<Listener>()

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit() {
  for (const listener of listeners) listener()
}

/* --------------------------------------------------------------- snapshots */

export function getResolvedTheme(): ResolvedTheme {
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'dark' ? 'dark' : 'light'
}

export function getPreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function getPhase(): Phase {
  const attr = document.documentElement.getAttribute('data-phase')
  return attr === 'short_break' || attr === 'long_break' ? attr : 'focus'
}

// Server render assumes the defaults; the blocking script corrects the DOM
// before paint and useSyncExternalStore reconciles after hydration.
export const serverTheme = (): ResolvedTheme => 'light'
export const serverPreference = (): ThemePreference => 'system'
export const serverPhase = (): Phase => 'focus'

/* ----------------------------------------------------------------- writers */

export function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', theme)
  emit()
}

export function setPreference(next: ThemePreference) {
  if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
  else window.localStorage.setItem(THEME_STORAGE_KEY, next)

  document.documentElement.setAttribute(
    'data-theme',
    next === 'system' ? systemTheme() : next,
  )
  emit()
}

export function setPhase(next: Phase) {
  document.documentElement.setAttribute('data-phase', next)
  window.localStorage.setItem(PHASE_STORAGE_KEY, next)
  emit()
}
