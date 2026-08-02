'use client'

import { useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { useTimerStore } from '@/lib/timer/store'
import { elapsedMs } from '@/lib/timer/machine'
import { formatDuration } from '@/lib/utils/dates'

/** Below this, a reset costs nothing and asking is just friction. */
const CONFIRM_THRESHOLD_MS = 60_000

export function TimerControls() {
  const status = useTimerStore((s) => s.runtime.status)
  const hydrated = useTimerStore((s) => s.hydrated)
  const [confirmReset, setConfirmReset] = useState(false)
  const [elapsedLabel, setElapsedLabel] = useState('')

  const idle = status === 'idle'
  const running = status === 'running'

  const handleReset = () => {
    const { runtime, reset } = useTimerStore.getState()
    const elapsed = elapsedMs(runtime, Date.now())

    if (elapsed >= CONFIRM_THRESHOLD_MS) {
      setElapsedLabel(formatDuration(Math.round(elapsed / 1000)))
      setConfirmReset(true)
      return
    }
    reset()
  }

  return (
    <>
      <div className="flex items-center justify-center gap-6">
        <IconButton
          label="Reset session"
          onClick={handleReset}
          disabled={!hydrated || idle}
        >
          <RotateCcw size={20} strokeWidth={1.75} />
        </IconButton>

        <IconButton
          label={running ? 'Pause session' : 'Start session'}
          variant="primary"
          size={64}
          disabled={!hydrated}
          onClick={() => useTimerStore.getState().toggle()}
        >
          {running ? (
            <Pause size={26} strokeWidth={1.75} fill="currentColor" />
          ) : (
            <Play size={26} strokeWidth={1.75} fill="currentColor" className="ml-0.5" />
          )}
        </IconButton>

        <IconButton
          label="Skip to next phase"
          onClick={() => useTimerStore.getState().skip()}
          disabled={!hydrated || idle}
        >
          <SkipForward size={20} strokeWidth={1.75} />
        </IconButton>
      </div>

      <ConfirmSheet
        open={confirmReset}
        title="Reset this session?"
        body={`You've focused for ${elapsedLabel}. That time is kept in your history, but the session starts over from the top.`}
        confirmLabel="Reset session"
        cancelLabel="Keep going"
        onConfirm={() => useTimerStore.getState().reset()}
        onClose={() => setConfirmReset(false)}
      />
    </>
  )
}
