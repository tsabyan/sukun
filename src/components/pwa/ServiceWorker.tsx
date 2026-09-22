'use client'

import { useEffect } from 'react'

/**
 * Registers the worker built by `serwist build` — docs/08-deployment.md §5.
 *
 * Configurator mode does not inject a registration the way the old webpack
 * plugin did, so it happens here. Deliberately after load rather than during:
 * registration competes with the first paint otherwise, and there is nothing
 * to serve from a cache on a first visit anyway.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        console.warn('[ajeg] service worker registration failed', error)
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })

    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
