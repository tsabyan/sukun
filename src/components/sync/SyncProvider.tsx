'use client'

import { useEffect } from 'react'
import { ensureSession, watchAuth } from '@/lib/supabase/auth'
import { recordDeviceHeartbeat } from '@/lib/db/repo'
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
    const stopWatching = watchAuth()

    // Counts this device once for today, guest or not. Queued through the
    // outbox, so it survives being offline and needs no session.
    void recordDeviceHeartbeat()

    void ensureSession()

    // Started unconditionally, not gated on a session. Signed out is the
    // normal state — the cycle then pushes only the insert-only tables, and
    // it is already listening when a magic link lands.
    const stopSync = startSync()

    return () => {
      stopWatching()
      stopSync()
    }
  }, [])

  return null
}
