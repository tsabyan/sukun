'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTimerStore } from './store'

interface PendingSwitch {
  id: string
  title: string
}

/**
 * Starting a focus session on a task, with one question in the way.
 *
 * The timer holds exactly one task, so tapping play on a second one used to
 * silently move the running session onto it — the first task kept its elapsed
 * minutes but stopped being what you were working on, and nothing said so.
 * Now a second task asks first, and offers the running one as the way out —
 * issue #6.
 *
 * Only a *focus* phase is protected. Attaching a task during a break is how
 * you line up the next block, and there is nothing to interrupt.
 */
export function useStartSession() {
  const router = useRouter()
  const [pending, setPending] = useState<PendingSwitch | null>(null)
  const runningTitle = useTimerStore((s) => s.attachedTaskTitle)

  const go = (id: string, title: string) => {
    const timer = useTimerStore.getState()
    timer.attachTask(id, title)
    if (timer.runtime.status !== 'running') timer.start()
    router.push('/focus')
  }

  return {
    /** The title of the session that would be taken over, for the copy. */
    runningTitle,
    pending,

    /** Play on a task row. Asks only when it would displace another task. */
    request(id: string, title: string) {
      const { runtime } = useTimerStore.getState()
      const busy =
        runtime.status !== 'idle' &&
        runtime.phase === 'focus' &&
        runtime.taskId !== null &&
        runtime.taskId !== id

      if (busy) {
        setPending({ id, title })
        return
      }
      go(id, title)
    },

    confirm() {
      if (!pending) return
      go(pending.id, pending.title)
      setPending(null)
    },

    cancel() {
      setPending(null)
    },
  }
}
