'use client'

import { useRouter } from 'next/navigation'
import { ListTodo, Sprout, UserRound } from 'lucide-react'
import { ActionSheet } from '@/components/ui/ActionSheet'

/**
 * B10 — what the bottom bar's "+" means on a screen that owns more than one
 * kind of thing.
 *
 * Home and Insights both do: neither is a list of one type, so the button asks
 * rather than guesses. Screens that own exactly one list (Tasks, Habits) skip
 * this and open their form straight away.
 */
export function AddMenu({
  open,
  onClose,
  onAddTask,
}: {
  open: boolean
  onClose: () => void
  onAddTask: () => void
}) {
  const router = useRouter()

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title="Add…"
      options={[
        {
          icon: ListTodo,
          title: 'Task',
          sub: 'Something to get done, with focus sessions',
          tone: 'green',
          onSelect: onAddTask,
        },
        {
          icon: Sprout,
          title: 'Habit',
          sub: 'A small thing you repeat · tracked with streaks',
          tone: 'green-mid',
          onSelect: () => router.push('/habits?new=habit'),
        },
        {
          icon: UserRound,
          title: 'Identity',
          sub: 'Who you are becoming · groups your habits',
          tone: 'surface',
          onSelect: () => router.push('/habits?new=identity'),
        },
      ]}
    />
  )
}
