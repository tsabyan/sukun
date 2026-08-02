'use client'

import { create } from 'zustand'

/**
 * Install affordances — docs/05-screens.md S10, docs/08-deployment.md §5.
 *
 * On iOS this matters more than it looks: notifications only work once the app
 * is on the Home Screen, so a Safari user who never installs will never hear a
 * session end. There is no API to trigger that — only instructions.
 */

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallStore {
  deferred: InstallPrompt | null
  set: (deferred: InstallPrompt | null) => void
}

export const useInstallStore = create<InstallStore>((set) => ({
  deferred: null,
  set: (deferred) => set({ deferred }),
}))

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates the standard and still reports it here.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch check separates them.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Chromium fires this once, early. Capture it or the Install button is dead. */
export function watchInstallPrompt(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onPrompt = (event: Event) => {
    event.preventDefault()
    useInstallStore.getState().set(event as InstallPrompt)
  }
  const onInstalled = () => useInstallStore.getState().set(null)

  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)

  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
}

export async function promptInstall(): Promise<boolean> {
  const deferred = useInstallStore.getState().deferred
  if (!deferred) return false

  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  useInstallStore.getState().set(null)
  return outcome === 'accepted'
}
