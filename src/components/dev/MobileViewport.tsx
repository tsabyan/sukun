'use client'

import { useEffect } from 'react'
import { DEV_PHONE_HEIGHT } from '@/lib/dev/state'

const PHONE_WIDTH = 390
const PHONE_HEIGHT = DEV_PHONE_HEIGHT

/**
 * `?mobile=1` forces the mobile layout at any window size: every min-width
 * media query is switched off and the document is clamped to a phone width.
 * Design tooling that cannot resize its own browser viewport can then capture
 * the real mobile screens. Development only.
 */
export function MobileViewport() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const params = new URLSearchParams(window.location.search)
    if (!params.has('mobile')) return

    const isMinWidth = (text: string) =>
      /min-width/.test(text) || /width\s*>=/.test(text) || /<=\s*width/.test(text)

    const disableUp = () => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue // cross-origin sheet
        }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSMediaRule && isMinWidth(rule.media.mediaText)) {
            rule.media.mediaText = 'not all'
          }
        }
      }
    }

    disableUp()
    // Dev CSS arrives in chunks, so re-run as stylesheets are appended.
    const observer = new MutationObserver(disableUp)
    observer.observe(document.head, { childList: true })

    const style = document.createElement('style')
    // Fixed elements (the tab bar, sheets, the daylight layer) measure against
    // the visual viewport, not the clamped body, so pin them to the phone box.
    style.textContent = [
      `html,body{width:${PHONE_WIDTH}px!important;max-width:${PHONE_WIDTH}px!important;margin:0!important;overflow-x:hidden!important}`,
      `html,body{height:fit-content!important;min-height:0!important}`,
      `body{position:relative!important}`,
      `[class*="fixed"]{position:absolute!important;left:0!important;right:auto!important;width:${PHONE_WIDTH}px!important;max-width:${PHONE_WIDTH}px!important}`,
      `[class*="fixed"][class*="inset-0"]{top:0!important;bottom:auto!important;height:${PHONE_HEIGHT}px!important}`,
      `[class*="fixed"][class*="bottom-0"]{top:auto!important;bottom:0!important}`,
      `[class*="min-h-screen"],[class*="min-h-dvh"],[class*="min-h-svh"],[class*="h-screen"],[class*="h-dvh"]{min-height:0!important;height:auto!important}`,
    ].join('')
    document.head.append(style)

    // A screen with an overlay open is captured as a phone box: the sheet sits
    // at the bottom of 844px and whatever the page had below is off-screen,
    // exactly as on a phone. Screens without one stay full-length, so the
    // whole scroll is visible in a single frame.
    const boxIfOverlay = window.setTimeout(() => {
      if (!document.querySelector('[class*="fixed"][class*="inset-0"]')) return
      const boxed = document.createElement('style')
      boxed.textContent = `html,body{height:${PHONE_HEIGHT}px!important;overflow:hidden!important}`
      document.head.append(boxed)
    }, 500)

    return () => {
      observer.disconnect()
      window.clearTimeout(boxIfOverlay)
    }
  }, [])

  return null
}
