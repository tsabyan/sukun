'use client'

import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * The one floating action — docs/05-screens.md §0.
 *
 * A top-right "+" is the hardest place on a phone to reach, so the primary
 * action lives in the middle of the bottom bar. It means the same thing on
 * every screen: open the Add menu.
 *
 * It is on *every* screen that has the bar, detail screens included. Hiding it
 * on a few of them — task, habit, identity, achievements — meant the bar
 * changed shape as you moved through the app, and the one control always under
 * the thumb was missing exactly where you had just finished reading something
 * and wanted to add the next one.
 */

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
