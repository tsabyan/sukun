'use client'

import { useEffect, useRef } from 'react'

/**
 * `?open=<name>` drives a screen into one of its transient states — a sheet,
 * a confirm, a picker — so design tooling that can only load URLs still sees
 * every modal. Applied after mount, so server and client markup still match.
 * Development only.
 */
export function useDevOpen(name: string, apply: () => boolean | void, deps: unknown[] = []) {
  const applied = useRef(false)
  useEffect(() => {
    if (applied.current) return
    if (process.env.NODE_ENV === 'production') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('open') !== name) return
    // `false` means the data the state needs has not loaded yet; try again
    // when the deps change.
    if (apply() === false) return
    applied.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Reads `?open=` directly, for states that need a value rather than a flag. */
export function devOpenParam(): string | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('open')
}

/** Height in CSS px of the phone box `?mobile=1` emulates. */
export const DEV_PHONE_HEIGHT = 844

/**
 * `?mobile=1` clamps the document to a phone box, but `dvh` units still read
 * the real browser viewport — which makes every sheet roughly twice as tall as
 * it would be on a phone. Components that size themselves in `dvh` ask here
 * for the emulated height instead. Development only; null otherwise.
 */
export function devPhoneHeight(): number | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).has('mobile') ? DEV_PHONE_HEIGHT : null
}
