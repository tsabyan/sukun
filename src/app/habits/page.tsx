'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { HabitCheck } from '@/components/habits/HabitCheck'
import { StreakBadge } from '@/components/habits/IdentityDetail'
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
import { haptic } from '@/lib/utils/haptics'
import { today as todayLocal } from '@/lib/utils/dates'
import { currentStreak, isScheduled } from '@/lib/habits/streaks'
import type { LocalDate } from '@/lib/db/types'

type View = { tab: 'today' | 'identities' } | { identityId: string; habitId?: string }

export default function HabitsPage() {
  const identities = useLiveQuery(() => live.identities(), [], undefined)
  const habits = useLiveQuery(() => live.habits(), [], undefined)
  const logs = useLiveQuery(() => live.habitLogs(), [], {} as Record<string, Set<LocalDate>>)

  const [view, setView] = useState<View>({ tab: 'today' })
  const [newIdentity, setNewIdentity] = useState('')

  if (!identities || !habits) {
    return (
      <div className="flex flex-col gap-2 pt-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-[76px] animate-pulse" />
        ))}
      </div>
    )
  }

  const today = todayLocal()
  const doneOf = (habitId: string) => logs[habitId] ?? new Set<LocalDate>()

  const toggleToday = async (habitId: string) => {
    const done = await toggleHabitDay(habitId, today)
    if (done) haptic('taskComplete')
  }

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
        identityName={identity.name || 'Identity'}
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
        onAddHabit={(name) => void createHabit(identity.id, name)}
        onOpenHabit={(habitId) => setView({ identityId: identity.id, habitId })}
        onToggleToday={toggleToday}
      />
    )
  }

  /* ---------- home ---------- */
  const addIdentity = () => {
    if (!newIdentity.trim()) return
    void createIdentity(newIdentity)
    setNewIdentity('')
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="text-body-sm text-ink-3">Become yourself, one day at a time</span>
        <h1 className="text-title-l font-display text-ink">Habits</h1>
      </header>

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
        <TodayView
          identities={identities}
          habits={habits}
          doneOf={doneOf}
          today={today}
          onToggle={toggleToday}
          onOpenIdentities={() => setView({ tab: 'identities' })}
        />
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={newIdentity}
              placeholder="New identity… (e.g. A guitarist)"
              onChange={(e) => setNewIdentity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addIdentity()}
              className="h-11 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3.5 text-body text-ink outline-none placeholder:text-ink-3 focus:border-accent"
            />
            <IconButton label="Add identity" variant="primary" onClick={addIdentity}>
              <Plus size={20} strokeWidth={2} />
            </IconButton>
          </div>

          {identities.length === 0 ? (
            <Card>
              <p className="text-body text-ink-2">
                Who do you want to become? Write one identity — “A guitarist”, “A healthy person”,
                “A writer” — then fill it with habits that prove it.
              </p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {identities.map((identity) => {
                const own = habits.filter((h) => h.identityId === identity.id)
                const scheduledToday = own.filter((h) => isScheduled(h, today))
                const doneToday = scheduledToday.filter((h) => doneOf(h.id).has(today)).length
                return (
                  <li key={identity.id}>
                    <Card
                      interactive
                      padding="compact"
                      onClick={() => setView({ identityId: identity.id })}
                      className="flex cursor-pointer flex-col gap-2"
                    >
                      <div className="text-body font-medium text-ink">
                        {identity.name || 'Untitled identity'}
                      </div>
                      <div className="text-body-sm text-ink-3">
                        {own.length} habit{own.length === 1 ? '' : 's'}
                        {scheduledToday.length > 0 && ` · today ${doneToday}/${scheduledToday.length}`}
                      </div>
                      {scheduledToday.length > 0 && (
                        <span className="block h-1.5 overflow-hidden rounded-full bg-hairline">
                          <span
                            className="block h-full rounded-full bg-accent transition-[width] duration-300"
                            style={{ width: `${(doneToday / scheduledToday.length) * 100}%` }}
                          />
                        </span>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ today */

function TodayView({
  identities,
  habits,
  doneOf,
  today,
  onToggle,
  onOpenIdentities,
}: {
  identities: import('@/lib/db/types').Identity[]
  habits: import('@/lib/db/types').Habit[]
  doneOf: (habitId: string) => Set<LocalDate>
  today: LocalDate
  onToggle: (habitId: string) => void
  onOpenIdentities: () => void
}) {
  const groups = identities
    .map((identity) => ({
      identity,
      habits: habits.filter((h) => h.identityId === identity.id && isScheduled(h, today)),
    }))
    .filter((g) => g.habits.length > 0)

  const total = groups.reduce((a, g) => a + g.habits.length, 0)
  const done = groups.reduce((a, g) => a + g.habits.filter((h) => doneOf(h.id).has(today)).length, 0)

  if (identities.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="text-body text-ink-2">
          Nothing here yet. Start with someone you want to become.
        </p>
        <button
          type="button"
          onClick={onOpenIdentities}
          className="text-body font-medium text-accent"
        >
          Add an identity →
        </button>
      </Card>
    )
  }

  if (total === 0) {
    return (
      <Card>
        <p className="text-body text-ink-2">No habits scheduled today. Enjoy your day.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body-sm tabular-nums text-ink-2">
        {done} of {total} done today
      </p>
      {groups.map((g) => (
        <section key={g.identity.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-label text-ink-2">{g.identity.name || 'Untitled'}</span>
            <span className="text-body-sm tabular-nums text-ink-3">
              {g.habits.filter((h) => doneOf(h.id).has(today)).length}/{g.habits.length}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {g.habits.map((h) => {
              const cur = currentStreak(h, doneOf(h.id), today)
              const doneToday = doneOf(h.id).has(today)
              return (
                <li key={h.id}>
                  <Card
                    padding="compact"
                    className={cnRow(doneToday)}
                  >
                    <span className="min-w-0 flex-1 truncate text-body text-ink">{h.name}</span>
                    <StreakBadge count={cur} />
                    <HabitCheck size="sm" done={doneToday} onToggle={() => onToggle(h.id)} />
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function cnRow(done: boolean) {
  return `flex items-center gap-3 ${done ? 'opacity-60' : ''}`
}
