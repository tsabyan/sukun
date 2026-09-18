'use client'

import { createElement } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Lock } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/Card'
import { HeroCard } from '@/components/ui/HeroCard'
import { PageHeader } from '@/components/shell/PageHeader'
import { Pill } from '@/components/ui/Pill'
import { getAchievements } from '@/lib/db/repo'
import { ACHIEVEMENTS, ACHIEVEMENT_COUNT, type AchievementGroup } from '@/lib/db/seed'
import { taskIcon } from '@/lib/tasks/icons'
import { useHideFab } from '@/lib/ui/fab'
import { cn } from '@/lib/utils/cn'

/** The catalogue's own grouping, in the order it should be worked through. */
const GROUPS: Array<{ key: AchievementGroup; title: string }> = [
  { key: 'first-steps', title: 'First steps' },
  { key: 'volume', title: 'Sessions' },
  { key: 'streaks', title: 'Streaks' },
  { key: 'depth', title: 'Depth' },
  { key: 'habit', title: 'Consistency' },
]

/**
 * E3 — Achievements.
 *
 * A page rather than the sheet it used to be: twenty-two badges in five groups
 * is a screen's worth of content, and locked badges keep their requirement on
 * them because a goal you cannot see is not a goal.
 */
export default function AchievementsPage() {
  const router = useRouter()
  const unlocked = useLiveQuery(
    async () => new Set((await getAchievements()).map((a) => a.key)),
    [],
  )

  useHideFab()

  const earned = unlocked?.size ?? 0
  const next = ACHIEVEMENTS.find((badge) => !unlocked?.has(badge.key))

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Achievements"
        leading={
          <button
            type="button"
            aria-label="Back to insights"
            onClick={() => router.push('/insights')}
            className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
        }
      />

      <HeroCard
        title="Unlocked"
        chip={<Pill tone="dark">All time</Pill>}
        value={`${earned} / ${ACHIEVEMENT_COUNT}`}
        sub={next ? `next: ${next.name}` : 'every badge earned'}
      >
        <div className="flex flex-col gap-2">
          <span className="on-hero block h-2.5 overflow-hidden rounded-full">
            <span
              className="block h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${(earned / ACHIEVEMENT_COUNT) * 100}%` }}
            />
          </span>
          {next && <span className="text-body-sm">{next.requirement}</span>}
        </div>
      </HeroCard>

      {GROUPS.map((group) => {
        const badges = ACHIEVEMENTS.filter((badge) => badge.group === group.key)
        const done = badges.filter((badge) => unlocked?.has(badge.key)).length
        return (
          <Card key={group.key} className="flex flex-col gap-3">
            <CardHead title={group.title}>
              <Pill>{`${done} of ${badges.length}`}</Pill>
            </CardHead>
            <ul className="grid grid-cols-3 gap-2">
              {badges.map((badge) => {
                const held = unlocked?.has(badge.key) ?? false
                return (
                  <li
                    key={badge.key}
                    title={badge.requirement}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-md px-2 py-3 text-center',
                      held ? 'bg-green-soft' : 'bg-field',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'inline-flex size-10 items-center justify-center rounded-full',
                        held ? 'bg-green text-ink' : 'bg-surface text-ink-3',
                      )}
                    >
                      {held
                        ? createElement(taskIcon(badge.icon), { size: 18, strokeWidth: 1.75 })
                        : createElement(Lock, { size: 16, strokeWidth: 1.75 })}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] leading-tight',
                        held ? 'text-ink' : 'text-ink-3',
                      )}
                    >
                      {badge.name}
                    </span>
                    <span className="sr-only">
                      {held ? 'Unlocked. ' : 'Locked. '}
                      {badge.requirement}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}
