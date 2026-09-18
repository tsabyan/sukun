'use client'

import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * The one floating action — docs/05-screens.md §0.
 *
 * A top-right "+" is the hardest place on a phone to reach, so the primary
 * action lives in the middle of the bottom bar. It means the same thing on
 * every screen: open the Add menu. A screen that changed the button's meaning
 * under you would make the one control you always reach for the one you have
 * to read first.
 *
 * Screens that are not a place to add anything — a task, a habit, an identity,
 * the achievements list — hide it instead.
 */
interface FabState {
  hidden: boolean
  setHidden: (hidden: boolean) => void
}

export const useFabStore = create<FabState>((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}))

/** Hides the add button for as long as this screen is mounted. */
export function useHideFab(hidden = true) {
  const setHidden = useFabStore((s) => s.setHidden)

  useEffect(() => {
    setHidden(hidden)
    // Cleanup runs before the next screen's effect, so a route change never
    // leaves the button hidden behind.
    return () => setHidden(false)
  }, [setHidden, hidden])
}

/* ------------------------------------------------------------------ intent */

export type AddIntent = 'task' | 'habit' | 'identity'

interface AddIntentState {
  intent: AddIntent | null
  request: (intent: AddIntent) => void
  clear: () => void
}

/**
 * What the Add menu asked for, until the screen that owns it picks it up.
 *
 * The menu could route with a query parameter instead, but `?new=habit` is
 * already on the URL when you ask twice, and a URL that has to change to be
 * noticed is a worse channel than a store.
 */
export const useAddIntentStore = create<AddIntentState>((set) => ({
  intent: null,
  request: (intent) => set({ intent }),
  clear: () => set({ intent: null }),
}))

/** Runs `apply` once, when the Add menu asks for this kind of thing. */
export function useAddIntent(intent: AddIntent, apply: () => void) {
  const pending = useAddIntentStore((s) => s.intent)
  const clear = useAddIntentStore((s) => s.clear)

  useEffect(() => {
    if (pending !== intent) return
    apply()
    clear()
    // `apply` is a fresh closure every render; the pending check is what stops
    // this from firing twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, intent, clear])
}
