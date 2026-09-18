'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Settings } from 'lucide-react'
import { Logomark } from '@/components/brand/Logomark'
import { HeroCard, HeroWeekBars } from '@/components/ui/HeroCard'
import { Pill } from '@/components/ui/Pill'
import { StatRow, StatTile } from '@/components/ui/StatTile'
import { NowFocusingBanner } from '@/components/home/NowFocusingBanner'
import { HOME_TASK_ROWS, TodayTasksCard } from '@/components/home/TodayTasksCard'
import { TodayHabitsCard, type HomeHabit } from '@/components/home/TodayHabitsCard'
import { TaskFormSheet } from '@/components/tasks/TaskFormSheet'
import { TimerAnnouncer } from '@/components/timer/TimerAnnouncer'
import { getRecentDayTotals, getStreaks, live, toggleHabitDay } from '@/lib/db/repo'
import { currentStreak, isScheduled, rate30 } from '@/lib/habits/streaks'
import { useDevOpen } from '@/lib/dev/state'
import { haptic } from '@/lib/utils/haptics'
import { fromLocalDate, today } from '@/lib/utils/dates'
import type { LocalDate, Task } from '@/lib/db/types'

/**
 * B1 — Home. docs/05-screens.md.
 *
 * Not the timer: the timer has its own screen. This is the one question the
 * app exists to answer — "how is today going, and what is next" — and every
 * row on it is a way to start. Tasks and habits share the page because a day
 * is made of both, and splitting them into two tabs made neither feel like
 * the day.
 */
export default function HomePage() {
  const router = useRouter()
  const [taskFormOpen, setTaskFormOpen] = useState(false)

  useDevOpen('new-task', () => setTaskFormOpen(true))

  const data = useLiveQuery(async () => {
    const day = today()
    const [planned, active, habits, logs, streaks, week] = await Promise.all([
      live.planned(day),
      live.tasks('active'),
      live.habits(),
      live.habitLogs(),
      getStreaks(),
      getRecentDayTotals(7),
    ])

    // Planned-for-today is the real answer; when the day hasn't been planned
    // the open tasks stand in, because an empty card teaches people to stop
    // looking at this one.
    const tasks: Task[] = planned.length > 0 ? planned : active
    const open = tasks.filter((t) => t.status === 'active')
    const done = tasks.filter((t) => t.status === 'completed')

    const todayHabits: HomeHabit[] = habits
      .filter((habit) => isScheduled(habit, day))
      .map((habit) => {
        const doneDays = logs[habit.id] ?? new Set<LocalDate>()
        return {
          habit,
          done: doneDays.has(day),
          streak: currentStreak(habit, doneDays, day),
        }
      })

    const consistency = habits.length
      ? Math.round(
          habits.reduce((sum, h) => sum + rate30(h, logs[h.id] ?? new Set<LocalDate>(), day), 0) /
            habits.length,
        )
      : null

    return {
      rows: [...open, ...done].slice(0, HOME_TASK_ROWS),
      tasksDone: done.length,
      tasksTotal: tasks.length,
      habits: todayHabits,
      streaks,
      consistency,
      week,
    }
  }, [])

  const habitsDone = data?.habits.filter((h) => h.done).length ?? 0
  const habitsTotal = data?.habits.length ?? 0
  const totalDone = (data?.tasksDone ?? 0) + habitsDone
  const total = (data?.tasksTotal ?? 0) + habitsTotal

  const max = Math.max(1, ...(data?.week.map((d) => d.focusSeconds) ?? [1]))

  const toggleHabit = async (habitId: string) => {
    const done = await toggleHabitDay(habitId, today())
    if (done) haptic('taskComplete')
  }

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex min-h-[52px] items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink">
            <Logomark size={18} className="text-green" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-title-s text-ink">Sukun</span>
            <span className="truncate text-body-sm text-ink-2">
              {data ? greeting(data.streaks.current) : ' '}
            </span>
          </span>
        </span>

        <Link
          href="/settings"
          aria-label="Settings"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-sm"
        >
          <Settings size={20} strokeWidth={1.75} />
        </Link>
      </header>

      <NowFocusingBanner />

      <HeroCard
        title="Today"
        chip={<Pill tone="dark">{weekday()}</Pill>}
        value={`${totalDone}/${total}`}
        sub={remainingLabel(
          (data?.tasksTotal ?? 0) - (data?.tasksDone ?? 0),
          habitsTotal - habitsDone,
          total,
        )}
      >
        <HeroWeekBars
          values={(data?.week ?? []).map((d) => d.focusSeconds / max)}
          labels={(data?.week ?? []).map(weekdayShort)}
        />
      </HeroCard>

      <StatRow>
        <StatTile
          value={data ? String(data.streaks.current) : '—'}
          label={
            data && data.streaks.longest > 0
              ? `day streak · best is ${data.streaks.longest}`
              : 'day streak · starts today'
          }
          href="/insights"
        />
        <StatTile
          value={data?.consistency != null ? `${data.consistency}%` : '—'}
          label={
            data?.consistency != null
              ? 'habit consistency · 30 days'
              : 'habit consistency · no habits yet'
          }
          href="/habits"
        />
      </StatRow>

      <TodayTasksCard
        tasks={data?.rows ?? []}
        done={data?.tasksDone ?? 0}
        total={data?.tasksTotal ?? 0}
        onAdd={() => setTaskFormOpen(true)}
      />

      <TodayHabitsCard
        habits={data?.habits ?? []}
        onToggle={toggleHabit}
        onAdd={() => router.push('/habits?new=habit')}
      />

      <TaskFormSheet open={taskFormOpen} onClose={() => setTaskFormOpen(false)} />

      <TimerAnnouncer />
    </div>
  )
}

function weekday() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long' })
}

function weekdayShort(day: { date: LocalDate }) {
  return fromLocalDate(day.date).toLocaleDateString(undefined, { weekday: 'short' })
}

function greeting(streak: number) {
  return streak > 0 ? `${streak} day streak · ${weekday()}` : `Welcome · ${weekday()}`
}

/** "done · 3 tasks and 2 habits left" — only the halves that still have work. */
function remainingLabel(tasks: number, habits: number, total: number) {
  if (total === 0) return 'Nothing planned yet'
  const parts: string[] = []
  if (tasks > 0) parts.push(`${tasks} task${tasks === 1 ? '' : 's'}`)
  if (habits > 0) parts.push(`${habits} habit${habits === 1 ? '' : 's'}`)
  if (parts.length === 0) return "done · that's everything"
  return `done · ${parts.join(' and ')} left`
}
