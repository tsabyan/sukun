'use client'

import { useEffect } from 'react'

/**
 * Exposes the repo on `window.__repo` for console poking. Development only —
 * the import is inside the effect so the module never reaches a production
 * bundle through this path.
 */
export function DevBridge() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return

    let cancelled = false
    void Promise.all([import('@/lib/db/repo'), import('@/lib/db/schema')]).then(
      ([repoModule, schemaModule]) => {
        if (cancelled) return
        const w = window as unknown as Record<string, unknown>
        w.__repo = repoModule.repo
        w.__db = schemaModule.db
        console.info('[sukun] window.__repo and window.__db ready')
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
