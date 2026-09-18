'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import type { LucideIcon } from 'lucide-react'

/**
 * The one floating action — docs/05-screens.md §0.
 *
 * A top-right "+" is the hardest place on a phone to reach, so the primary
 * action of every screen lives in the bottom bar beside the tab capsule
 * instead. It belongs to the screen, not the shell: each page declares its own
 * ("New task", "New habit", "Start session") and the shell just renders
 * whatever is registered. Nothing registered means no button, and the tab
 * capsule takes the full width.
 *
 * It sits inside the strip the content already pads for, so unlike a true
 * floating button it never covers a row.
 */
export interface PageAction {
  label: string
  icon: LucideIcon
  onPress: () => void
}

interface PageActionState {
  action: PageAction | null
  setAction: (action: PageAction | null) => void
}

export const usePageActionStore = create<PageActionState>((set) => ({
  action: null,
  setAction: (action) => set({ action }),
}))

/**
 * Registers this screen's action for as long as it is mounted. Pass null to
 * declare that the screen has no primary action.
 */
export function usePageAction(action: PageAction | null) {
  const setAction = usePageActionStore((s) => s.setAction)
  const label = action?.label
  const icon = action?.icon
  const onPress = action?.onPress

  useEffect(() => {
    if (!label || !icon || !onPress) {
      setAction(null)
      return
    }
    setAction({ label, icon, onPress })
    // Cleanup runs before the next screen's effect, so a route change never
    // leaves the previous screen's button behind.
    return () => setAction(null)
  }, [setAction, label, icon, onPress])
}
