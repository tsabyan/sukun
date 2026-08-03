'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTimerStore } from '@/lib/timer/store'

/**
 * Desktop keyboard path — docs/04-design-system.md §7.
 *
 * Space, S, F, N, Esc. Every one is ignored while the user is typing, or the
 * space bar becomes unusable in the create sheet — which is exactly the kind
 * of shortcut that gets a feature removed rather than fixed.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function KeyboardShortcuts() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // The flip clock owns its own keys, and a dialog owns Escape.
    if (pathname.startsWith('/focus')) return

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target)) return
      // The onboarding overlay is always in the DOM, just hidden, so a bare
      // [role="dialog"] check would disable every shortcut forever.
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
      if (dialogs.some((el) => (el as HTMLElement).offsetParent !== null)) return

      switch (event.key) {
        case ' ':
          event.preventDefault()
          useTimerStore.getState().toggle()
          break
        case 's':
        case 'S':
          useTimerStore.getState().skip()
          break
        case 'f':
        case 'F':
          router.push('/focus')
          break
        case 'n':
        case 'N':
          router.push('/tasks?new=1')
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, pathname])

  return null
}
