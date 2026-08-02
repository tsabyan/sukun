'use client'

import { useEffect } from 'react'
import { bindTimerListeners, useTimerStore } from '@/lib/timer/store'
import { setPhase as setDocumentPhase } from '@/lib/theme/store'

/**
 * Mounted once in the root layout, so a running session survives navigation —
 * the timer belongs to the app, not to the timer screen.
 *
 * Hydration is async (IndexedDB), which is why the countdown renders a
 * skeleton until `hydrated` flips. Showing 25:00 and then snapping to 13:42 is
 * worse than showing nothing for one frame.
 */
export function TimerEngine() {
  useEffect(() => {
    void useTimerStore.getState().hydrate()
    return bindTimerListeners()
  }, [])

  // The phase drives --accent for the entire app, so it lives on <html> rather
  // than in a React context. Writing it here means the tab bar, the ring, and
  // every focus outline cross-fade together on a phase change.
  useEffect(() => {
    setDocumentPhase(useTimerStore.getState().runtime.phase)
    return useTimerStore.subscribe((state, previous) => {
      if (state.runtime.phase !== previous.runtime.phase) {
        setDocumentPhase(state.runtime.phase)
      }
    })
  }, [])

  return null
}
