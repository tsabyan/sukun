import Link from 'next/link'
import { Wordmark } from '@/components/brand/Logomark'

/**
 * Placeholder. The Focus Timer (S1) lands in Phase 3 —
 * see docs/05-screens.md and docs/07-roadmap.md.
 */
export default function Home() {
  return (
    <div className="flex flex-col items-center gap-6 pt-24 text-center">
      <Wordmark size={28} />
      <p className="max-w-sm text-body text-ink-2">
        Foundation is in place. The focus timer arrives in Phase 3.
      </p>
      <Link
        href="/kitchen-sink"
        className="text-label text-accent underline underline-offset-4"
      >
        Open the kitchen sink
      </Link>
    </div>
  )
}
