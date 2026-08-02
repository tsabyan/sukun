'use client'

import { useEffect, useSyncExternalStore } from 'react'
import * as store from './store'

export type { ThemePreference, ResolvedTheme, Phase } from './store'

/**
 * Keeps the document in sync with the OS while the preference is 'system'.
 * There is no React state here — theme lives on <html>. See ./store.ts.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (store.getPreference() !== 'system') return
      store.applyResolvedTheme(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return <>{children}</>
}

export function useTheme() {
  const preference = useSyncExternalStore(
    store.subscribe,
    store.getPreference,
    store.serverPreference,
  )
  const resolved = useSyncExternalStore(
    store.subscribe,
    store.getResolvedTheme,
    store.serverTheme,
  )
  const phase = useSyncExternalStore(store.subscribe, store.getPhase, store.serverPhase)

  return {
    preference,
    resolved,
    phase,
    setPreference: store.setPreference,
    setPhase: store.setPhase,
  }
}
