'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Logomark } from '@/components/brand/Logomark'

/**
 * Route-level error boundary.
 *
 * A white screen loses a user permanently, and the data is still safely in
 * IndexedDB either way — so this says what happened, promises nothing was
 * lost, and offers the one action that usually works.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[sukun] route error', error)
  }, [error])

  return (
    <div className="flex flex-col items-center gap-5 pt-24 text-center">
      <Logomark size={32} className="text-ink-3" />
      <h1 className="text-title-l font-display text-ink">This screen stopped working</h1>
      <p className="max-w-sm text-body text-ink-2">
        Your tasks and sessions are safe on this device — nothing was lost. Try loading
        the screen again.
      </p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
      {error.digest && (
        <p className="text-body-sm text-ink-3">Reference {error.digest}</p>
      )}
    </div>
  )
}
