'use client'

import { useState } from 'react'
import { useDevOpen } from '@/lib/dev/state'
import { Check, Mail } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { sendMagicLink, signInWithGoogle } from '@/lib/supabase/auth'

/**
 * Signing in — docs/05-screens.md F1.
 *
 * Lifted out of the settings list and into its own sheet (issue #8): signing
 * in is a short flow with two branches and a keyboard, and an inset list row
 * that grows a Google button, a divider and a text field is not a row any
 * more. Anonymous stays the normal state; this is the opt-in.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function SyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useDevOpen('signin-error', () => {
    setEmail('not-an-email')
    setError('Could not send that link. Check the address and try again.')
  })
  useDevOpen('signin-sent', () => setSent(true))

  const continueWithGoogle = async () => {
    setConnecting(true)
    setError(null)
    const { error: failure } = await signInWithGoogle()
    // On success the page has already redirected; only a failed start lands here.
    if (failure) {
      setError(failure)
      setConnecting(false)
    }
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

  const close = () => {
    onClose()
    // let the sheet finish leaving before resetting
    window.setTimeout(() => {
      setSent(false)
      setEmail('')
      setError(null)
    }, 300)
  }

  return (
    <Sheet open={open} onClose={close} snapPoints={[0.9]} title="Sync across devices">
      {sent ? (
        <div className="flex flex-col items-start gap-4">
          <span className="accent-muted inline-flex size-11 items-center justify-center rounded-full">
            <Check size={22} strokeWidth={2} className="text-accent" />
          </span>
          <p className="text-body text-ink">Check {email} for a sign-in link.</p>
          <p className="text-body-sm text-ink-2">
            Open it on this device and everything you have already done comes with you.
          </p>
          <Button variant="secondary" fullWidth onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-2">
            Your data stays on this device until you sign in. An account backs it up and
            keeps two devices in step.
          </p>

          <Button
            variant="secondary"
            fullWidth
            disabled={connecting}
            onClick={() => void continueWithGoogle()}
          >
            {connecting ? 'Redirecting…' : 'Continue with Google'}
          </Button>

          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-body-sm text-ink-3">or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <Field
            label="Email"
            labelHidden
            icon={Mail}
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

          <Button variant="primary" fullWidth disabled={sending} onClick={() => void submit()}>
            {sending ? 'Sending…' : 'Send me a sign-in link'}
          </Button>

          <p className="text-center text-body-sm text-ink-3">
            No password. The link works once, and only on the device you open it on.
          </p>
        </div>
      )}
    </Sheet>
  )
}
