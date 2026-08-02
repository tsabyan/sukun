'use client'

import { useEffect } from 'react'
import { ensureSession, watchAuth } from '@/lib/supabase/auth'
import { startSync } from '@/lib/sync/engine'

/**
 * Brings up auth and sync once, app-wide.
 *
 * Ordering matters and only in one direction: a session has to exist before
 * the first sync cycle, or the push has no uid to write against. Everything
 * else is fire-and-forget — none of this blocks a single pixel.
 */
export function SyncProvider() {
  useEffect(() => {
    let stopSync: (() => void) | undefined
    const stopWatching = watchAuth()

    void ensureSession().then((session) => {
      if (session) stopSync = startSync()
    })

    return () => {
      stopWatching()
      stopSync?.()
    }
  }, [])

  return null
}
