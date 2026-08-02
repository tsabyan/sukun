import { create } from 'zustand'

/**
 * Sync status, kept in its own module with no Supabase import.
 *
 * SyncIndicator renders in the root layout on every route. When it read this
 * store from `engine.ts`, the whole Supabase client came with it into the
 * first-paint bundle of a timer screen that may never sync at all.
 */

export type SyncState = 'idle' | 'syncing' | 'offline' | 'stalled' | 'disabled'

interface SyncStore {
  state: SyncState
  lastSyncedAt: number | null
  pendingCount: number
  set: (patch: Partial<Omit<SyncStore, 'set'>>) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  // Starts quiet. The engine downgrades this to 'disabled' if the project is
  // not configured, once it has loaded.
  state: 'idle',
  lastSyncedAt: null,
  pendingCount: 0,
  set: (patch) => set(patch),
}))
