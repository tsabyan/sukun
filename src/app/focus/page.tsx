import Link from 'next/link'
import { PhasePlaceholder } from '@/components/ui/PhasePlaceholder'

/** Fullscreen route — the app shell deliberately does not render here. */
export default function FocusPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <PhasePlaceholder screen="Flip Clock" phase={7} doc="docs/05-screens.md S3" />
      <Link href="/" className="text-label text-accent underline underline-offset-4">
        Back to the timer
      </Link>
    </div>
  )
}
