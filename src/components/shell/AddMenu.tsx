'use client'

import { useRouter } from 'next/navigation'
import { ListTodo, Sprout, UserRound } from 'lucide-react'
import { ActionSheet } from '@/components/ui/ActionSheet'
import { useAddIntentStore, type AddIntent } from '@/lib/ui/fab'

/**
 * B10 — what the bottom bar's "+" opens, on every screen.
 *
 * The button never changes meaning, so the menu carries the choice: three
 * things the app can make, each landing on the screen that owns it. Already
 * there? The screen just opens its form.
 */
const ROUTES: Record<AddIntent, string> = {
  task: '/tasks',
  habit: '/habits',
  identity: '/habits',
}

export function AddMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const request = useAddIntentStore((s) => s.request)

  const go = (intent: AddIntent) => () => {
    request(intent)
    router.push(ROUTES[intent])
  }

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
          onSelect: go('task'),
        },
        {
          icon: Sprout,
          title: 'Habit',
          sub: 'A small thing you repeat · tracked with streaks',
          tone: 'green-mid',
          onSelect: go('habit'),
        },
        {
          icon: UserRound,
          title: 'Identity',
          sub: 'Who you are becoming · groups your habits',
          tone: 'surface',
          onSelect: go('identity'),
        },
      ]}
    />
  )
}
