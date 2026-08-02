import type { SessionMode } from '@/lib/db/types'

/**
 * Local notifications — an enhancement, never the only signal.
 *
 * They are unreliable when the tab is fully closed, and on iOS they require
 * the app be installed to the Home Screen. The in-tab chime is the primary
 * alert; this is what reaches a user who has switched to another window.
 *
 * Permission is never requested on load. A cold prompt gets denied, and a
 * denial is permanent — so it is asked for in context, after the user's first
 * completed session.
 */

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationState(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as PermissionState
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationState() === 'unsupported') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission as PermissionState

  try {
    return (await Notification.requestPermission()) as PermissionState
  } catch {
    return 'denied'
  }
}

const COPY: Record<SessionMode, { title: string; body: string }> = {
  focus: { title: 'Session complete', body: 'Time for a break.' },
  short_break: { title: 'Break over', body: 'Ready for the next session?' },
  long_break: { title: 'Long break over', body: 'Ready when you are.' },
}

export function notifyPhaseEnd(mode: SessionMode, taskTitle?: string | null) {
  if (notificationState() !== 'granted') return

  const { title, body } = COPY[mode]
  try {
    new Notification(title, {
      body: mode === 'focus' && taskTitle ? `${taskTitle} — time for a break.` : body,
      tag: 'sukun-phase',
      icon: '/icons/192.png',
      silent: true, // the chime is the sound; two alerts at once is noise
    })
  } catch {
    // Some browsers only allow notifications from a service worker. The chime
    // already fired, so there is nothing to recover from.
  }
}
