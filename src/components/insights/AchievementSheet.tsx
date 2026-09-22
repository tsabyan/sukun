'use client'

import { createElement } from 'react'
import { Check, Lock } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Pill } from '@/components/ui/Pill'
import { taskIcon } from '@/lib/tasks/icons'
import { cn } from '@/lib/utils/cn'
import type { AchievementDef } from '@/lib/db/seed'
import type { Timestamp } from '@/lib/db/types'

/**
 * E3b — one badge, and what it takes.
 *
 * The requirement was only ever a `title` tooltip and screen-reader text, so on
 * a phone a locked badge was a padlock and a two-word name with no way to find
 * out what it wanted. Tapping one now says it plainly — issue #6 follow-up.
 */
export function AchievementSheet({
  badge,
  unlockedAt,
  onClose,
}: {
  /** null when nothing is selected; the sheet is closed */
  badge: AchievementDef | null
  unlockedAt: Timestamp | undefined
  onClose: () => void
}) {
  const held = unlockedAt !== undefined

  return (
    <Sheet open={badge !== null} onClose={onClose} snapPoints={[0.9]} title={badge?.name ?? ''}>
      {badge && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className={cn(
                'inline-flex size-14 shrink-0 items-center justify-center rounded-full',
                held ? 'bg-green text-on-accent' : 'bg-field text-ink-3',
              )}
            >
              {createElement(held ? taskIcon(badge.icon) : Lock, {
                size: held ? 24 : 20,
                strokeWidth: 1.75,
              })}
            </span>
            <Pill tone={held ? 'accent' : 'neutral'}>
              {held ? (
                <>
                  <Check size={12} strokeWidth={2} aria-hidden />
                  Unlocked {formatUnlocked(unlockedAt)}
                </>
              ) : (
                'Locked'
              )}
            </Pill>
          </div>

          <div className="flex flex-col gap-2">
            <span className="eyebrow text-ink-3">
              {held ? 'What it took' : 'How to unlock'}
            </span>
            <p className="text-body text-ink">{badge.requirement}</p>
          </div>

          {!held && (
            <p className="text-body-sm text-ink-2">
              Badges unlock on their own the moment the work is done. Nothing to
              claim.
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** "on 3 Sep 2026" — the day is the part worth remembering, not the minute. */
function formatUnlocked(at: Timestamp | undefined) {
  if (!at) return ''
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return `on ${date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}
