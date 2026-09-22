import { Mascot } from '@/components/brand/Mascot'

/**
 * The navigation fallback when a page is not cached and the network is gone.
 *
 * Reached rarely, because the shell is precached and the data is already on
 * the device. It explains rather than apologises: nothing has been lost, and
 * there is a way back.
 */
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 text-center">
      <Mascot size={72} mood="resting" />
      <h1 className="text-title-l font-display text-ink">No connection</h1>
      <p className="max-w-xs text-body text-ink-2">
        This page is not on the device yet. Your tasks and sessions are — go back and
        keep working.
      </p>
    </div>
  )
}
