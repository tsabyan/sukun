'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  ChevronDown,
  Coffee,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { AttachTaskSheet } from '@/components/timer/AttachTaskSheet'
import { TimerAnnouncer } from '@/components/timer/TimerAnnouncer'
import { live } from '@/lib/db/repo'
import { useTimerStore } from '@/lib/timer/store'
import { elapsedMs, nextPhase } from '@/lib/timer/machine'
import { formatCountdown, formatDuration } from '@/lib/utils/dates'
import { cn } from '@/lib/utils/cn'

/** Below this, a reset costs nothing and asking is just friction. */
const CONFIRM_THRESHOLD_MS = 60_000

const EYEBROW = {
  focus: 'FOCUS',
  short_break: 'SHORT BREAK',
  long_break: 'LONG BREAK',
} as const

/**
 * S2 — the focus screen. docs/05-screens.md.
 *
 * The running timer, full bleed, and nothing else: one number, one progress
 * line, the task it belongs to, and three controls in the thumb zone. Focus
 * is lime; a break inverts to charcoal, so looking up tells you which side of
 * the cycle you are on without reading a word.
 *
 * Minimising (the chevron) returns to Focus with the clock still running —
 * this screen is a view of the machine, never the machine itself.
 */
export default function FocusScreen() {
  const router = useRouter()

  const seconds = useTimerStore((s) => Math.ceil(s.remainingMs / 1000))
  const status = useTimerStore((s) => s.runtime.status)
  const phase = useTimerStore((s) => s.runtime.phase)
  const cycleCount = useTimerStore((s) => s.runtime.cycleCount)
  const perCycle = useTimerStore((s) => s.durations.sessionsUntilLongBreak)
  const hydrated = useTimerStore((s) => s.hydrated)
  const muted = useTimerStore((s) => s.muted)
  const taskTitle = useTimerStore((s) => s.attachedTaskTitle)
  const taskId = useTimerStore((s) => s.runtime.taskId)
  const phaseSeconds = useTimerStore((s) =>
    s.runtime.phase === 'focus'
      ? s.durations.focus
      : s.runtime.phase === 'short_break'
        ? s.durations.shortBreak
        : s.durations.longBreak,
  )
  /**
   * Which break comes after the focus phase in progress. `nextPhase` is the
   * machine's own rule, applied to the count this session will produce, so the
   * hint never disagrees with what actually happens.
   */
  const breakSeconds = useTimerStore((s) => {
    const after = s.runtime.phase === 'focus' ? s.runtime.cycleCount + 1 : s.runtime.cycleCount
    return nextPhase('focus', after, s.durations) === 'long_break'
      ? s.durations.longBreak
      : s.durations.shortBreak
  })

  /**
   * The attached task's own plan. The pill used to count the long-break cycle
   * — always "of 4", whatever the task asked for — which read as a claim about
   * the task and was wrong for every task not estimated at four sessions. With
   * a task attached, the count is that task's; the dots below still show the
   * cycle, which is the machine's business, not the task's. Issue #6.
   */
  const task = useLiveQuery(() => (taskId ? live.task(taskId) : undefined), [taskId])
  const taskTotal = task?.estimatedPomodoros ?? 0
  const taskDone = task?.completedPomodoros ?? 0

  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [elapsedLabel, setElapsedLabel] = useState('')

  const onBreak = phase !== 'focus'
  const paused = status === 'paused'
  const idle = status === 'idle'
  /** A finished focus session leaves the machine idle on a break phase. */
  const justFinished = idle && onBreak
  const progress = Math.max(0, Math.min(1, 1 - seconds / Math.max(1, phaseSeconds)))
  const sessionIndex = cycleCount % perCycle

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
    <div
      className={cn(
        'relative flex min-h-dvh flex-col',
        onBreak ? 'bg-ink text-surface' : 'bg-green text-ink',
      )}
    >
      {/* — top bar */}
      <header className="flex items-center justify-between gap-3 px-4 pt-3">
        <IconButton
          label="Minimise"
          variant="secondary"
          className={onBreak ? 'border-transparent bg-surface/10 text-surface' : 'border-transparent'}
          onClick={() => router.push('/')}
        >
          <ChevronDown size={20} strokeWidth={1.75} />
        </IconButton>

        <Pill tone={onBreak ? 'neutral' : 'dark'}>
          {justFinished
            ? taskTotal > 0
              ? `${Math.min(taskDone, taskTotal)} of ${taskTotal} done`
              : `Session ${Math.max(1, sessionIndex)} of ${perCycle} done`
            : paused
              ? 'Paused'
              : onBreak
                ? taskTotal > 0
                  ? `${Math.min(taskDone, taskTotal)} of ${taskTotal} done`
                  : `${sessionIndex} of ${perCycle} done`
                : taskTotal > 0
                  ? `Session ${Math.min(taskDone + 1, taskTotal)} of ${taskTotal}`
                  : `Session ${sessionIndex + 1} of ${perCycle}`}
        </Pill>

        <IconButton
          label={muted ? 'Unmute chime' : 'Mute chime'}
          variant="secondary"
          className={onBreak ? 'border-transparent bg-surface/10 text-surface' : 'border-transparent'}
          onClick={() => useTimerStore.getState().toggleMuted()}
        >
          {muted ? <VolumeX size={20} strokeWidth={1.75} /> : <Volume2 size={20} strokeWidth={1.75} />}
        </IconButton>
      </header>

      {/* — the clock */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        {justFinished ? (
          <span className="mb-1 inline-flex size-24 items-center justify-center rounded-xl bg-surface/10">
            <Check size={44} strokeWidth={1.75} className="text-green" />
          </span>
        ) : null}

        <p className={cn('eyebrow', onBreak ? 'text-surface/60' : 'text-ink/60')}>
          {justFinished ? 'SESSION DONE' : EYEBROW[phase]}
        </p>

        {justFinished ? (
          <p className="text-center text-title-l">
            {taskId && taskTitle
              ? `${formatDuration(phaseSecondsOfFocus())} on ${taskTitle}`
              : `${formatDuration(phaseSecondsOfFocus())} of focus`}
          </p>
        ) : (
          <p
            aria-hidden
            className={cn(
              'numerals text-display-xl transition-opacity duration-200',
              paused && 'opacity-55',
            )}
          >
            {hydrated ? formatCountdown(seconds * 1000) : '––:––'}
          </p>
        )}

        {!justFinished && (
          <div
            className={cn(
              'h-1.5 w-full max-w-[280px] overflow-hidden rounded-full',
              onBreak ? 'bg-surface/20' : 'on-hero-strong',
            )}
          >
            {/* No width transition. The bar is re-rendered every second
                anyway, so the animation bought nothing — and a CSS transition
                does not advance while the tab is hidden, which is exactly what
                this app tells you to do (lock the phone, switch apps). Coming
                back could leave the fill parked at the value it had when you
                left. Issue #6. */}
            <div
              className={cn('h-full rounded-full', onBreak ? 'bg-green' : 'bg-ink')}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => !onBreak && setPickerOpen(true)}
          disabled={onBreak}
          className={cn(
            'inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2.5 text-body font-medium',
            onBreak ? 'bg-surface/10 text-surface' : 'bg-surface text-ink',
          )}
        >
          {onBreak ? (
            <>
              <Coffee size={16} strokeWidth={1.75} className="text-green" aria-hidden />
              Stand up. Look at something far away.
            </>
          ) : (
            <>
              {!taskId && <Plus size={16} strokeWidth={2} aria-hidden />}
              <span className="truncate">
                {taskId && taskTitle ? taskTitle : 'Attach a task'}
              </span>
            </>
          )}
        </button>

        {/* session dots — where you are in the cycle */}
        <div className="flex items-center gap-2" aria-hidden>
          {Array.from({ length: perCycle }, (_, i) => {
            const done = i < sessionIndex
            const current = !onBreak && i === sessionIndex
            return (
              <span
                key={i}
                className={cn(
                  'h-2.5 rounded-full',
                  current ? 'w-7' : 'w-2.5',
                  done || current
                    ? onBreak
                      ? 'bg-surface'
                      : 'bg-ink'
                    : onBreak
                      ? 'border-[1.5px] border-surface/50'
                      : 'border-[1.5px] border-ink/40',
                )}
              />
            )
          })}
        </div>
      </div>

      {/* — controls */}
      {justFinished ? (
        <div className="flex flex-col gap-2.5 px-5 pb-3">
          <Button
            variant="accent"
            size="lg"
            fullWidth
            onClick={() => useTimerStore.getState().start()}
          >
            <Coffee size={18} strokeWidth={1.75} aria-hidden />
            Start break · {formatDuration(breakSeconds)}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            className="border-transparent bg-surface/10 text-surface"
            onClick={() => useTimerStore.getState().skip()}
          >
            Skip break, keep going
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-6 pb-3">
          <IconButton
            label="Reset"
            size={56}
            variant="secondary"
            className={onBreak ? 'border-transparent bg-surface/10 text-surface' : 'border-transparent'}
            onClick={handleReset}
          >
            <RotateCcw size={22} strokeWidth={1.75} />
          </IconButton>

          <IconButton
            label={status === 'running' ? 'Pause' : 'Start'}
            size={80}
            variant={onBreak ? 'accent' : 'primary'}
            onClick={() => useTimerStore.getState().toggle()}
          >
            {status === 'running' ? (
              <Pause size={30} strokeWidth={1.75} />
            ) : (
              <Play size={30} strokeWidth={1.75} />
            )}
          </IconButton>

          <IconButton
            label={onBreak ? 'End break' : 'Skip'}
            size={56}
            variant="secondary"
            className={onBreak ? 'border-transparent bg-surface/10 text-surface' : 'border-transparent'}
            onClick={() => useTimerStore.getState().skip()}
          >
            {onBreak ? <X size={22} strokeWidth={1.75} /> : <SkipForward size={22} strokeWidth={1.75} />}
          </IconButton>
        </div>
      )}

      <p
        className={cn(
          'pb-4 text-center text-body-sm',
          onBreak ? 'text-surface/60' : 'text-ink/60',
        )}
      >
        {justFinished
          ? `Next: focus session ${Math.min(perCycle, sessionIndex + 1)} of ${perCycle}`
          : paused
            ? "Resume when you're ready"
            : onBreak
              ? 'Next: focus session'
              : `Next: break · ${formatDuration(breakSeconds)}`}
      </p>

      <AttachTaskSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />

      <ConfirmSheet
        open={confirmReset}
        title="Reset this session?"
        body={`${elapsedLabel} of focus will not be recorded. The session count stays where it is.`}
        confirmLabel="Reset session"
        cancelLabel="Keep going"
        destructive
        onConfirm={() => {
          useTimerStore.getState().reset()
          setConfirmReset(false)
        }}
        onClose={() => setConfirmReset(false)}
      />

      <TimerAnnouncer />
    </div>
  )
}

/** The length of the focus phase that just ended, for the "done" headline. */
function phaseSecondsOfFocus() {
  return useTimerStore.getState().durations.focus
}
