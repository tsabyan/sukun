'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
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
 * The feature list is honest about what Pro would actually be, because a
 * signal collected against a lie is not a signal.
 */

const PRO_FEATURES = [
  'Unlimited tasks',
  'Sync across your devices',
  'Custom themes',
  'Export your data',
  'AI subtask breakdown',
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function UpsellSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

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
    <Sheet open={open} onClose={close} snapPoints={[0.62]} title="You've hit the free limit">
      {submitted ? (
        <div className="flex flex-col items-start gap-4 py-4">
          <span className="accent-muted inline-flex size-11 items-center justify-center rounded-full">
            <Check size={22} strokeWidth={2} className="text-accent" />
          </span>
          <p className="text-body text-ink">We&apos;ll email you when Pro is ready.</p>
          <p className="text-body-sm text-ink-2">
            Nothing else — no newsletter, no launch countdown.
          </p>
          <Button variant="secondary" fullWidth onClick={close}>
            Back to tasks
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-body text-ink-2">
            The free tier holds {FREE_TASK_LIMIT} active tasks. Complete or delete one to
            add another, or leave your email and we&apos;ll tell you when Pro lands.
          </p>

          <ul className="flex flex-col gap-2">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-body text-ink">
                <Check size={16} strokeWidth={2} className="shrink-0 text-accent" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>

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

          <Button variant="primary" fullWidth disabled={saving} onClick={() => void submit()}>
            Notify me at launch
          </Button>
        </div>
      )}
    </Sheet>
  )
}
