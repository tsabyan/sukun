'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus, Settings, Sprout, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card, CardHead } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { HeroCard, HeroWeekBars } from '@/components/ui/HeroCard'
import { IconTile } from '@/components/ui/IconTile'
import { Pill, ChipButton } from '@/components/ui/Pill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { HabitRow } from '@/components/habits/HabitRow'
import { NewHabitSheet } from '@/components/habits/NewHabitSheet'
import { NewIdentitySheet } from '@/components/habits/NewIdentitySheet'
import { IdentityDetail } from '@/components/habits/IdentityDetail'
import { HabitDetail } from '@/components/habits/HabitDetail'
import {
  createHabit,
  createIdentity,
  deleteHabit,
  deleteIdentity,
  live,
  toggleHabitDay,
  updateHabit,
  updateIdentity,
} from '@/lib/db/repo'
import { currentStreak, isScheduled, longestStreak } from '@/lib/habits/streaks'
import { useDevOpen } from '@/lib/dev/state'
import { usePageAction } from '@/lib/ui/page-action'
import { haptic } from '@/lib/utils/haptics'
import { addDays, fromLocalDate, today as todayLocal } from '@/lib/utils/dates'
import type { Habit, LocalDate } from '@/lib/db/types'

type View = { tab: 'today' | 'identities' } | { identityId: string; habitId?: string }

/**
 * D1/D2 — Habits. docs/05-screens.md.
 *
 * Two views of the same thing: what has to happen today, and who the habits
 * are supposed to be making you. Identity is the organising idea, so it owns
 * a tab rather than living in a settings corner.
 */
export default function HabitsPage() {
  return (
    <Suspense fallback={<HabitsSkeleton />}>
      <HabitsView />
    </Suspense>
  )
}

/**
 * Split from the default export only because `useSearchParams` opts a page out
 * of prerendering unless it sits under a Suspense boundary.
 */
function HabitsView() {
  const params = useSearchParams()
  const identities = useLiveQuery(() => live.identities(), [], undefined)
  const habits = useLiveQuery(() => live.habits(), [], undefined)
  const logs = useLiveQuery(() => live.habitLogs(), [], {} as Record<string, Set<LocalDate>>)

  const [view, setView] = useState<View>({ tab: 'today' })
  const [newHabitFor, setNewHabitFor] = useState<string | null>(null)
  const [habitSheet, setHabitSheet] = useState(false)
  const [identitySheet, setIdentitySheet] = useState(false)

  // Home's add menu routes here with what it wants opened.
  const [handledParam, setHandledParam] = useState<string | null>(null)
  const wanted = params.get('new')
  if (wanted && wanted !== handledParam) {
    setHandledParam(wanted)
    if (wanted === 'identity') {
      setView({ tab: 'identities' })
      setIdentitySheet(true)
    }
    if (wanted === 'habit') setHabitSheet(true)
  }

  useDevOpen('habits-identities', () => setView({ tab: 'identities' }))
  useDevOpen('new-identity', () => setIdentitySheet(true))
  useDevOpen('new-habit', () => setHabitSheet(true))
  useDevOpen(
    'identity',
    () => {
      if (!identities?.length) return false
      setView({ identityId: identities[0].id })
    },
    [identities],
  )
  useDevOpen(
    'habit',
    () => {
      if (!identities?.length || !habits?.length) return false
      const habit = habits.find((h) => h.identityId === identities[0].id) ?? habits[0]
      setView({ identityId: habit.identityId, habitId: habit.id })
    },
    [identities, habits],
  )

  const onDetail = 'identityId' in view

  usePageAction(
    onDetail
      ? null
      : {
          label: view.tab === 'today' ? 'New habit' : 'New identity',
          icon: Plus,
          onPress: () =>
            view.tab === 'today' ? setHabitSheet(true) : setIdentitySheet(true),
        },
  )

  if (!identities || !habits) return <HabitsSkeleton />

  const today = todayLocal()
  const doneOf = (habitId: string) => logs[habitId] ?? new Set<LocalDate>()

  const toggleToday = async (habitId: string) => {
    const done = await toggleHabitDay(habitId, today)
    if (done) haptic('taskComplete')
  }

  const sheets = (
    <>
      <NewIdentitySheet
        open={identitySheet}
        onClose={() => setIdentitySheet(false)}
        onCreate={(name) => void createIdentity(name)}
      />
      <NewHabitSheet
        open={habitSheet}
        onClose={() => setHabitSheet(false)}
        identities={identities}
        identityId={newHabitFor ?? identities[0]?.id ?? null}
        onPickIdentity={setNewHabitFor}
        onCreate={({ identityId, name, schedule }) =>
          void createHabit(identityId, name, schedule)
        }
      />
    </>
  )

  /* ---------- habit detail ---------- */
  if ('identityId' in view && view.habitId) {
    const identity = identities.find((x) => x.id === view.identityId)
    const habit = habits.find((h) => h.id === view.habitId)
    if (!identity || !habit) {
      setView({ tab: 'identities' })
      return null
    }
    return (
      <HabitDetail
        habit={habit}
        identityName={identity.name}
        done={doneOf(habit.id)}
        onBack={() => setView({ identityId: identity.id })}
        onRename={(name) => void updateHabit(habit.id, { name })}
        onToggleScheduleDay={(weekday) => {
          const has = habit.schedule.includes(weekday)
          let next = has ? habit.schedule.filter((d) => d !== weekday) : [...habit.schedule, weekday]
          if (next.length === 0) next = [weekday]
          void updateHabit(habit.id, { schedule: next })
        }}
        onToggleDay={(day) => void toggleHabitDay(habit.id, day)}
        onDelete={() => {
          void deleteHabit(habit.id)
          setView({ identityId: identity.id })
        }}
      />
    )
  }

  /* ---------- identity detail ---------- */
  if ('identityId' in view) {
    const identity = identities.find((x) => x.id === view.identityId)
    if (!identity) {
      setView({ tab: 'identities' })
      return null
    }
    return (
      <>
        <IdentityDetail
          identity={identity}
          habits={habits.filter((h) => h.identityId === identity.id)}
          logs={logs}
          onBack={() => setView({ tab: 'identities' })}
          onRenameIdentity={(name) => void updateIdentity(identity.id, { name })}
          onDeleteIdentity={() => {
            void deleteIdentity(identity.id)
            setView({ tab: 'identities' })
          }}
          onAddHabit={() => {
            setNewHabitFor(identity.id)
            setHabitSheet(true)
          }}
          onOpenHabit={(habitId) => setView({ identityId: identity.id, habitId })}
          onToggleToday={toggleToday}
        />
        {sheets}
      </>
    )
  }

  /* ---------- the two tabs ---------- */
  const scheduled = habits.filter((h) => isScheduled(h, today))
  const doneToday = scheduled.filter((h) => doneOf(h.id).has(today)).length
  const best = habits.reduce(
    (top, habit) => Math.max(top, longestStreak(habit, doneOf(habit.id), today)),
    0,
  )

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Habits"
        actions={
          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
          >
            <Settings size={20} strokeWidth={1.75} />
          </Link>
        }
      />

      <SegmentedControl<'today' | 'identities'>
        aria-label="Habits view"
        segments={[
          { value: 'today', label: 'Today' },
          { value: 'identities', label: 'Identities', count: identities.length },
        ]}
        value={view.tab}
        onChange={(tab) => setView({ tab })}
      />

      {view.tab === 'today' ? (
        <>
          <HeroCard
            title="Today"
            chip={<Pill tone="dark">{weekdayName(today)}</Pill>}
            value={`${doneToday} / ${scheduled.length}`}
            sub={
              scheduled.length === 0
                ? 'Nothing scheduled today'
                : `${scheduled.length - doneToday} left · best streak ${best} day${best === 1 ? '' : 's'}`
            }
          >
            <WeekBars habits={habits} doneOf={doneOf} today={today} />
          </HeroCard>

          {identities.length === 0 ? (
            <Card>
              <EmptyState
                icon={UserRound}
                title="No identities yet"
                body="Start with someone you want to become. Habits hang off who you are, not off a list."
                action={
                  <ChipButton selected onClick={() => setIdentitySheet(true)}>
                    <Plus size={14} strokeWidth={2} aria-hidden />
                    Add an identity
                  </ChipButton>
                }
              />
            </Card>
          ) : scheduled.length === 0 ? (
            <Card>
              <EmptyState
                icon={Sprout}
                title={habits.length === 0 ? 'No habits yet' : 'Nothing scheduled today'}
                body={
                  habits.length === 0
                    ? 'Habits are small things you repeat. Add one under an identity you want to grow into.'
                    : 'None of your habits run today. Enjoy the gap — the streaks know.'
                }
                action={
                  habits.length === 0 ? (
                    <ChipButton selected onClick={() => setHabitSheet(true)}>
                      <Plus size={14} strokeWidth={2} aria-hidden />
                      Add a habit
                    </ChipButton>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            identities
              .map((identity) => ({
                identity,
                rows: scheduled.filter((h) => h.identityId === identity.id),
              }))
              .filter((group) => group.rows.length > 0)
              .map(({ identity, rows }) => (
                <Card key={identity.id} className="flex flex-col gap-3">
                  <CardHead title={identity.name || 'Untitled identity'}>
                    <Pill>
                      {`${rows.filter((h) => doneOf(h.id).has(today)).length} of ${rows.length}`}
                    </Pill>
                  </CardHead>
                  <ul className="flex flex-col">
                    {rows.map((habit) => (
                      <HabitRow
                        key={habit.id}
                        name={habit.name}
                        streak={currentStreak(habit, doneOf(habit.id), today)}
                        done={doneOf(habit.id).has(today)}
                        onOpen={() => setView({ identityId: identity.id, habitId: habit.id })}
                        onToggle={() => void toggleToday(habit.id)}
                      />
                    ))}
                  </ul>
                </Card>
              ))
          )}
        </>
      ) : (
        <>
          <HeroCard
            title="Identities"
            chip={<Pill tone="dark">All time</Pill>}
            value={String(identities.length)}
            sub={`${habits.length} habit${habits.length === 1 ? '' : 's'} · ${best} day best streak`}
          >
            <WeekBars habits={habits} doneOf={doneOf} today={today} />
          </HeroCard>

          {identities.length === 0 ? (
            <Card>
              <EmptyState
                icon={UserRound}
                title="No identities yet"
                body="Who do you want to become? Write one — “A guitarist”, “A calm reader” — then fill it with the habits that prove it."
                action={
                  <ChipButton selected onClick={() => setIdentitySheet(true)}>
                    <Plus size={14} strokeWidth={2} aria-hidden />
                    Add an identity
                  </ChipButton>
                }
              />
            </Card>
          ) : (
            identities.map((identity) => {
              const own = habits.filter((h) => h.identityId === identity.id)
              const due = own.filter((h) => isScheduled(h, today))
              const done = due.filter((h) => doneOf(h.id).has(today)).length
              const complete = due.length > 0 && done === due.length
              return (
                <Card
                  key={identity.id}
                  interactive
                  padding="compact"
                  onClick={() => setView({ identityId: identity.id })}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <IconTile
                    icon={UserRound}
                    tone={complete ? 'green' : 'field'}
                    size={44}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-title-s text-ink">
                      {identity.name || 'Untitled identity'}
                    </span>
                    <span className="truncate text-body-sm text-ink-2">
                      {own.length} habit{own.length === 1 ? '' : 's'}
                      {due.length > 0 && ` · ${done} done today`}
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-track">
                      <span
                        className={cnBar(complete)}
                        style={{ width: `${due.length ? (done / due.length) * 100 : 0}%` }}
                      />
                    </span>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} className="text-ink" aria-hidden />
                </Card>
              )
            })
          )}
        </>
      )}

      {sheets}
    </div>
  )
}

function cnBar(complete: boolean) {
  return `block h-full rounded-full transition-[width] duration-300 ${complete ? 'bg-green' : 'bg-ink'}`
}

function weekdayName(date: LocalDate) {
  return fromLocalDate(date).toLocaleDateString(undefined, { weekday: 'long' })
}

/**
 * Seven days of habit completion, as a fraction of what was scheduled that
 * day. A day with nothing scheduled draws a stub rather than a full bar —
 * nothing due is not the same as everything done.
 */
function WeekBars({
  habits,
  doneOf,
  today,
}: {
  habits: Habit[]
  doneOf: (habitId: string) => Set<LocalDate>
  today: LocalDate
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const values = days.map((day) => {
    const due = habits.filter((habit) => isScheduled(habit, day))
    if (due.length === 0) return 0
    return due.filter((habit) => doneOf(habit.id).has(day)).length / due.length
  })

  return (
    <HeroWeekBars
      values={values}
      labels={days.map((day) =>
        fromLocalDate(day).toLocaleDateString(undefined, { weekday: 'short' }),
      )}
    />
  )
}

function HabitsSkeleton() {
  return (
    <div className="flex flex-col gap-2 pt-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="h-[76px] animate-pulse" />
      ))}
    </div>
  )
}
