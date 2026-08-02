'use client'

import { useRouter } from 'next/navigation'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { updateSettings } from '@/lib/db/repo'

/**
 * Two views of the same running machine. Choosing Flip navigates to the
 * full-screen clock and remembers the choice, so the next launch opens where
 * the user left off.
 */
export function ModeToggle() {
  const router = useRouter()

  return (
    <SegmentedControl
      aria-label="Timer view"
      className="mx-auto max-w-[280px]"
      segments={[
        { value: 'flip', label: 'Flip clock' },
        { value: 'ring', label: 'Timer' },
      ]}
      value="ring"
      onChange={(mode) => {
        if (mode !== 'flip') return
        void updateSettings({ defaultTimerMode: 'flip' })
        router.push('/focus')
      }}
    />
  )
}
