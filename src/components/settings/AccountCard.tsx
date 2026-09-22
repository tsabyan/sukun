'use client'

import { useState } from 'react'
import { useDevOpen } from '@/lib/dev/state'
import { ChevronRight, CloudOff } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { SyncSheet } from './SyncSheet'
import { useAuthStore, signOut } from '@/lib/supabase/auth'
import { syncNow, useSyncStore } from '@/lib/sync/engine'
import type { SyncState } from '@/lib/sync/state'
import { cn } from '@/lib/utils/cn'

/**
 * Who you are, at the top of Settings — docs/05-screens.md F1.
 *
 * A charcoal card rather than another inset group (issue #8): the account is
 * the one row on this screen that is about a person rather than a preference,
 * and three list rows saying "Signed in / Sync now / Sign out" buried under
 * Data made the state you are actually in hard to read at a glance. The card
 * states it — avatar, name, address, and whether sync has caught up — and the
 * two actions move into the sheet it opens.
 */

/** The dot in the status pill, one colour per sync state. */
const DOT: Record<SyncState, string> = {
  idle: 'bg-green',
  syncing: 'bg-green',
  offline: 'bg-surface/40',
  stalled: 'bg-priority-medium',
  disabled: 'bg-surface/40',
}

function statusLabel(state: SyncState, lastSyncedAt: number | null): string {
  if (state === 'syncing') return 'Syncing…'
  if (state === 'offline') return 'Offline'
  if (state === 'stalled') return 'Waiting'
  if (state === 'disabled') return 'Local only'
  return lastSyncedAt ? 'Synced' : 'Up to date'
}

/** "tsaqib@example.com" → "Tsaqib", unless the provider gave us a real name. */
function displayName(email: string | undefined, metadata: Record<string, unknown>): string {
  const given = metadata.full_name ?? metadata.name
  if (typeof given === 'string' && given.trim()) return given.trim()
  const local = email?.split('@')[0] ?? 'You'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

export function AccountCard() {
  const state = useAuthStore((s) => s.state)
  const session = useAuthStore((s) => s.session)
  const syncState = useSyncStore((s) => s.state)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)

  const [signInOpen, setSignInOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  useDevOpen('sign-in', () => setSignInOpen(true))
  useDevOpen('account', () => setAccountOpen(true))

  if (state === 'unconfigured') {
    return (
      <section className="flex items-center gap-3 rounded-lg bg-ink p-3.5 text-surface">
        <span
          aria-hidden
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface/10"
        >
          <CloudOff size={20} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium">On this device only</span>
          <span className="block truncate text-body-sm text-surface/60">
            Sync is not available on this build
          </span>
        </span>
      </section>
    )
  }

  if (state !== 'linked') {
    return (
      <>
        <button
          type="button"
          onClick={() => setSignInOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg bg-ink p-3.5 text-left text-surface"
        >
          <span
            aria-hidden
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface/10"
          >
            <CloudOff size={20} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-medium">Sync across devices</span>
            <span className="block truncate text-body-sm text-surface/60">
              Everything is on this device only
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-surface/50" aria-hidden />
        </button>

        <SyncSheet open={signInOpen} onClose={() => setSignInOpen(false)} />
      </>
    )
  }

  const email = session?.user.email ?? undefined
  const name = displayName(email, (session?.user.user_metadata ?? {}) as Record<string, unknown>)

  return (
    <>
      <button
        type="button"
        onClick={() => setAccountOpen(true)}
        aria-label={`Account · ${name}`}
        className="flex w-full items-center gap-3 rounded-lg bg-ink p-3.5 text-left text-surface"
      >
        <span
          aria-hidden
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-green text-label text-on-accent"
        >
          {initials(name)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium">{name}</span>
          {email && <span className="block truncate text-body-sm text-surface/60">{email}</span>}
        </span>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface/10 px-2.5 py-1.5 text-body-sm">
          <span aria-hidden className={cn('size-1.5 rounded-full', DOT[syncState])} />
          {statusLabel(syncState, lastSyncedAt)}
        </span>
      </button>

      <Sheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        snapPoints={[0.9]}
        title={name}
      >
        <div className="flex flex-col gap-4">
          {email && <p className="text-body text-ink-2">{email}</p>}

          {/* retryStalled: pressing this by hand is a deliberate "try again
              now", so entries parked at the backoff cap get a clean attempt
              rather than waiting out their timer. */}
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setAccountOpen(false)
              void syncNow({ retryStalled: true })
            }}
          >
            Sync now
          </Button>

          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setAccountOpen(false)
              void signOut().then(() => toast('Signed out'))
            }}
          >
            Sign out
          </Button>

          <p className="text-center text-body-sm text-ink-3">
            Everything stays on this device.
          </p>
        </div>
      </Sheet>
    </>
  )
}
