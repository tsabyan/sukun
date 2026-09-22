'use client'

/**
 * Asks the browser not to evict this app's data.
 *
 * The whole app lives in IndexedDB, and by default IndexedDB is *best effort*
 * storage: the browser may clear it whenever it likes. On iOS that is not
 * hypothetical — Safari's tracking prevention deletes script-written storage
 * for a site left unvisited for seven days, which for a guest means every
 * task, every session and every streak, with no account to restore from and
 * nothing to tell them it happened.
 *
 * `persist()` moves the origin to durable storage, after which data is only
 * removed if the user removes it. Browsers answer differently:
 *
 *   - Chromium grants it silently once the site looks engaged-with, and
 *     always for an installed PWA — which is the strongest reason to install.
 *   - Firefox shows a permission prompt.
 *   - Safari does not implement it; it returns false and the seven-day rule
 *     still applies to a site that was never added to the Home Screen.
 *
 * So this is a request, not a guarantee, and the app is designed to survive
 * the answer being no. It is still worth asking: for most users it turns a
 * silent data loss into no data loss at all.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false

  try {
    // Already durable — asking again would re-prompt on Firefox for nothing.
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
