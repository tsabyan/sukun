'use client'

import { useEffect } from 'react'
import { ensureSession, watchAuth } from '@/lib/supabase/auth'
import { recordDeviceHeartbeat, recordEvent, seedSettings } from '@/lib/db/repo'
import { startSync } from '@/lib/sync/engine'
import { requestPersistentStorage } from '@/lib/db/persistence'

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

    // Persist the settings row once, here in a normal (writable) context —
    // reads go through the pure getSettings, which never seeds, so a live
    // query can never trip a ReadOnlyError.
    void seedSettings()

    // IndexedDB is evictable by default, and this app has nothing else. Asked
    // once per load; browsers that have already granted it answer instantly.
    void requestPersistentStorage()

    // Counts this device once for today, guest or not. Queued through the
    // outbox, so it survives being offline and needs no session.
    void recordDeviceHeartbeat()

    // The top of the activation funnel. The heartbeat above says the device
    // existed today; this says the app was opened, and every later event is
    // read against it — docs/10-validation.md §3.
    void recordEvent('app_opened')

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
