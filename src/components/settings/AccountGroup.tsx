'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { SettingsGroup, SettingsRow, SettingsButtonRow } from './SettingsList'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { useAuthStore, sendMagicLink, signOut } from '@/lib/supabase/auth'
import { syncNow, useSyncStore } from '@/lib/sync/engine'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Account and sync — docs/05-screens.md S9.
 *
 * Anonymous is the normal state, not a degraded one, so this group leads with
 * what the user gets by adding an email rather than warning them about not
 * having one.
 */
export function AccountGroup() {
  const state = useAuthStore((s) => s.state)
  const session = useAuthStore((s) => s.session)
  const syncState = useSyncStore((s) => s.state)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state === 'unconfigured') {
    return (
      <SettingsGroup
        title="Account"
        footnote="Everything is stored on this device. Nothing leaves it."
      >
        <SettingsRow label="Sync" description="Not available on this build" />
      </SettingsGroup>
    )
  }

  const submit = async () => {
    const value = email.trim()
    if (!EMAIL_PATTERN.test(value)) {
      setError("That address doesn't look right.")
      return
    }

    setSending(true)
    setError(null)
    const { error: failure } = await sendMagicLink(value)
    setSending(false)

    if (failure) {
      setError(failure)
      return
    }
    setSent(true)
  }

  const syncLabel =
    syncState === 'syncing'
      ? 'Syncing…'
      : syncState === 'offline'
        ? 'Offline'
        : syncState === 'stalled'
          ? 'Some changes are waiting'
          : lastSyncedAt
            ? // An absolute time rather than "2m ago": a relative label
              // computed during render is both impure and quietly wrong the
              // moment the component stops re-rendering.
              `Synced ${new Date(lastSyncedAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'Up to date'

  if (state === 'linked') {
    return (
      <SettingsGroup title="Account">
        <SettingsRow label="Signed in" description={session?.user.email ?? undefined} />
        <SettingsButtonRow label="Sync now" value={syncLabel} onClick={() => void syncNow()} />
        <SettingsButtonRow
          label="Sign out"
          description="Everything stays on this device"
          onClick={() => void signOut().then(() => toast('Signed out'))}
        />
      </SettingsGroup>
    )
  }

  return (
    <SettingsGroup
      title="Account"
      footnote="Sukun works without an account. Everything you have done so far is already saved on this device."
    >
      {sent ? (
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="accent-muted mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full">
            <Check size={16} strokeWidth={2} className="text-accent" />
          </span>
          <p className="text-body text-ink-2">
            Check {email} for a sign-in link. Open it on this device and everything you
            have already done comes with you.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-body text-ink">Sync across devices</p>
          <p className="text-body-sm text-ink-2">
            Add an email to reach your tasks and history from anywhere else. No password,
            and nothing you have already done is lost.
          </p>
          <Field
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            error={error ?? undefined}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
          <Button variant="primary" disabled={sending} onClick={() => void submit()}>
            Send sign-in link
          </Button>
        </div>
      )}
    </SettingsGroup>
  )
}
