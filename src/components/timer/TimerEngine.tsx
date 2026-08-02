'use client'

import { useEffect } from 'react'
import { bindTimerListeners, useTimerStore } from '@/lib/timer/store'

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

  return null
}
