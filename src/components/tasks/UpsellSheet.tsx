'use client'

import { useState } from 'react'
import { useDevOpen } from '@/lib/dev/state'
import { Check, Lock, Mail } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { FREE_TASK_LIMIT, joinWaitlist } from '@/lib/db/repo'

/**
 * The gate without the checkout — docs/01-prd.md §7.
 *
 * There is no payment flow in v1 on purpose. What this measures is
 * willingness to pay: the conversion rate from hitting the cap to leaving an
 * email. A fake checkout would measure nothing and burn the trust of the few
 * people who bothered.
 *
 * The sheet leads with the count rather than with a feature list — issue #8.
 * A ticked list of things you cannot buy yet reads as a pricing page for a
 * product that does not exist; "10 / 10 active tasks" is the fact that
 * actually stopped you, and the way out of it ("complete a task instead") is
 * a button rather than a sentence.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function UpsellSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useDevOpen('upsell-error', () => {
    setEmail('not-an-email')
    setError("That address doesn't look right.")
  })
  useDevOpen('upsell-sent', () => setSubmitted(true))

  const submit = async () => {
    const value = email.trim()
    if (!EMAIL_PATTERN.test(value)) {
      setError("That address doesn't look right.")
      return
    }

    setSaving(true)
    try {
      await joinWaitlist(value, 'task_cap')
      setSubmitted(true)
    } catch {
      setError('Could not save that just now. Try again in a moment.')
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    onClose()
    // let the sheet finish leaving before resetting
    window.setTimeout(() => {
      setSubmitted(false)
      setEmail('')
      setError(null)
    }, 300)
  }

  return (
    <Sheet open={open} onClose={close} snapPoints={[0.9]} title="You've hit the free limit">
      {submitted ? (
        <div className="flex flex-col items-start gap-4 py-4">
          <span className="accent-muted inline-flex size-11 items-center justify-center rounded-full">
            <Check size={22} strokeWidth={2} className="text-accent" />
          </span>
          <p className="text-body text-ink">We&apos;ll email you when Ajeg Plus is ready.</p>
          <p className="text-body-sm text-ink-2">
            Nothing else — no newsletter, no launch countdown.
          </p>
          <Button variant="secondary" fullWidth onClick={close}>
            Back to tasks
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* the count that stopped you, stated as the hero of the sheet */}
          <section className="flex items-center justify-between gap-3 rounded-lg bg-green p-4 text-on-accent">
            <div className="min-w-0">
              <p className="numerals text-display-s">
                {FREE_TASK_LIMIT} / {FREE_TASK_LIMIT}
              </p>
              <p className="text-body-sm">active tasks on the free plan</p>
            </div>
            <span
              aria-hidden
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-on-accent"
            >
              <Lock size={20} strokeWidth={1.75} className="text-lime" />
            </span>
          </section>

          <p className="text-body text-ink-2">
            Ajeg Plus lifts the cap and syncs everything across devices. It isn&apos;t ready
            yet — leave an email and we&apos;ll tell you the moment it is.
          </p>

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

          <div className="flex flex-col gap-2.5">
            <Button variant="primary" fullWidth disabled={saving} onClick={() => void submit()}>
              Join the waitlist
            </Button>
            <Button variant="secondary" fullWidth onClick={close}>
              Complete a task instead
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
