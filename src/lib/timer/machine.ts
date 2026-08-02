import type { SessionMode } from '@/lib/db/types'

/**
 * The timer, as a pure reducer — docs/02-architecture.md §3, docs/06 §2.
 *
 * No React, no Dexie, no Date.now(). `now` is always an argument. That is the
 * whole reason this file exists separately: a timer whose correctness depends
 * on the wall clock cannot be tested, and a Pomodoro app whose timer drifts is
 * worthless.
 *
 * The invariant that matters most: remaining time is DERIVED from `endsAt`,
 * never counted down. Browsers throttle background timers to once a minute or
 * freeze them outright, so a decremented counter loses whole minutes. Pausing
 * is just moving the finish line.
 */

export type TimerStatus = 'idle' | 'running' | 'paused'

export interface TimerRuntime {
  phase: SessionMode
  status: TimerStatus
  /** epoch ms — when this phase first started */
  startedAt: number | null
  /** epoch ms — startedAt + duration + accumulated pause time */
  endsAt: number | null
  /** epoch ms — set on pause, cleared on resume */
  pausedAt: number | null
  /**
   * The duration this phase was started with, in seconds.
   *
   * Not in the original spec, added because the reducer needs it: pause time
   * is derived as (endsAt - startedAt) - plannedDuration, and reading the
   * duration from current settings breaks if the user edits them mid-session.
   * Also drives the idle display.
   */
  plannedDurationSec: number
  taskId: string | null
  /** completed focus sessions in the current long-break cycle */
  cycleCount: number
}

export interface Durations {
  /** seconds */
  focus: number
  shortBreak: number
  longBreak: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
}

export type TimerEvent =
  | { type: 'START'; now: number; durations: Durations }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'RESET'; now: number; durations: Durations }
  | { type: 'SKIP'; now: number; durations: Durations }
  | { type: 'COMPLETE'; now: number; durations: Durations }
  | { type: 'ATTACH_TASK'; taskId: string | null }

/**
 * What the reducer hands back when a phase ends. Epoch milliseconds, not ISO
 * strings — converting to the storage shape is the caller's job, so this file
 * stays free of date libraries and timezone opinions.
 */
export interface SessionOutcome {
  taskId: string | null
  mode: SessionMode
  plannedDurationSec: number
  actualDurationSec: number
  startedAtMs: number
  endedAtMs: number
  completed: boolean
  interrupted: boolean
}

export interface Reduction {
  state: TimerRuntime
  session?: SessionOutcome
}

/* ----------------------------------------------------------------- helpers */

export function phaseDuration(phase: SessionMode, d: Durations): number {
  switch (phase) {
    case 'focus':
      return d.focus
    case 'short_break':
      return d.shortBreak
    case 'long_break':
      return d.longBreak
  }
}

export function initialRuntime(d: Durations): TimerRuntime {
  return {
    phase: 'focus',
    status: 'idle',
    startedAt: null,
    endsAt: null,
    pausedAt: null,
    plannedDurationSec: d.focus,
    taskId: null,
    cycleCount: 0,
  }
}

/** Milliseconds left. Never negative, never counted down. */
export function remainingMs(state: TimerRuntime, now: number): number {
  if (state.status === 'idle' || state.endsAt === null) {
    return state.plannedDurationSec * 1000
  }
  const reference = state.status === 'paused' && state.pausedAt !== null ? state.pausedAt : now
  return Math.max(0, state.endsAt - reference)
}

export function elapsedMs(state: TimerRuntime, now: number): number {
  if (state.startedAt === null || state.endsAt === null) return 0

  // endsAt has absorbed every pause, so the gap above the planned duration is
  // exactly the time spent paused.
  const totalPaused = state.endsAt - state.startedAt - state.plannedDurationSec * 1000
  const reference = state.status === 'paused' && state.pausedAt !== null ? state.pausedAt : now
  const raw = reference - state.startedAt - totalPaused

  return Math.min(Math.max(0, raw), state.plannedDurationSec * 1000)
}

/**
 * Which phase follows, given a cycle count that has ALREADY been advanced for
 * the phase that just finished.
 */
export function nextPhase(phase: SessionMode, cycleCount: number, d: Durations): SessionMode {
  if (phase !== 'focus') return 'focus'
  return cycleCount > 0 && cycleCount % d.sessionsUntilLongBreak === 0
    ? 'long_break'
    : 'short_break'
}

function begin(
  state: TimerRuntime,
  phase: SessionMode,
  now: number,
  d: Durations,
): TimerRuntime {
  const duration = phaseDuration(phase, d)
  return {
    ...state,
    phase,
    status: 'running',
    startedAt: now,
    endsAt: now + duration * 1000,
    pausedAt: null,
    plannedDurationSec: duration,
  }
}

function idleOn(state: TimerRuntime, phase: SessionMode, d: Durations): TimerRuntime {
  return {
    ...state,
    phase,
    status: 'idle',
    startedAt: null,
    endsAt: null,
    pausedAt: null,
    plannedDurationSec: phaseDuration(phase, d),
  }
}

function shouldAutoStart(phase: SessionMode, d: Durations): boolean {
  return phase === 'focus' ? d.autoStartFocus : d.autoStartBreaks
}

/** A phase that ran no measurable time is not a session. */
function outcomeFor(
  state: TimerRuntime,
  endedAtMs: number,
  actualMs: number,
  completed: boolean,
): SessionOutcome | undefined {
  const actualDurationSec = Math.round(actualMs / 1000)
  if (state.startedAt === null || actualDurationSec <= 0) return undefined

  return {
    taskId: state.taskId,
    mode: state.phase,
    plannedDurationSec: state.plannedDurationSec,
    actualDurationSec,
    startedAtMs: state.startedAt,
    endedAtMs,
    completed,
    interrupted: !completed,
  }
}

/* ----------------------------------------------------------------- reducer */

export function reduce(state: TimerRuntime, event: TimerEvent): Reduction {
  switch (event.type) {
    case 'ATTACH_TASK':
      return { state: { ...state, taskId: event.taskId } }

    case 'START': {
      // Starting an already-running or paused timer must never restart it.
      // Resuming is a separate, explicit event.
      if (state.status !== 'idle') return { state }
      return { state: begin(state, state.phase, event.now, event.durations) }
    }

    case 'PAUSE': {
      if (state.status !== 'running') return { state }
      return { state: { ...state, status: 'paused', pausedAt: event.now } }
    }

    case 'RESUME': {
      if (state.status !== 'paused' || state.pausedAt === null || state.endsAt === null) {
        return { state }
      }
      // Shift the finish line by exactly the time spent paused.
      const pausedFor = event.now - state.pausedAt
      return {
        state: {
          ...state,
          status: 'running',
          endsAt: state.endsAt + pausedFor,
          pausedAt: null,
        },
      }
    }

    case 'RESET': {
      if (state.status === 'idle') {
        return { state: idleOn(state, state.phase, event.durations) }
      }
      // The time really was spent, so it is recorded — as interrupted.
      const ended = state.status === 'paused' && state.pausedAt !== null ? state.pausedAt : event.now
      const session = outcomeFor(state, ended, elapsedMs(state, event.now), false)
      return { state: idleOn(state, state.phase, event.durations), session }
    }

    case 'SKIP': {
      const { durations } = event
      const ended = state.status === 'paused' && state.pausedAt !== null ? state.pausedAt : event.now
      const session =
        state.status === 'idle'
          ? undefined
          : outcomeFor(state, ended, elapsedMs(state, event.now), false)

      // Skipping does not earn a cycle — only a completed focus phase does.
      const upcoming = nextPhase(state.phase, state.cycleCount, durations)
      const cycleCount = state.phase === 'long_break' ? 0 : state.cycleCount

      const base = { ...state, cycleCount }
      return {
        state: shouldAutoStart(upcoming, durations)
          ? begin(base, upcoming, event.now, durations)
          : idleOn(base, upcoming, durations),
        session,
      }
    }

    case 'COMPLETE': {
      const { durations } = event
      if (state.status === 'idle' || state.startedAt === null || state.endsAt === null) {
        return { state }
      }

      // The phase ended when the clock said it did, not when we noticed. A
      // backgrounded tab can return minutes late; the session must never claim
      // more time than it actually ran.
      const endedAtMs = state.endsAt
      const session = outcomeFor(state, endedAtMs, state.plannedDurationSec * 1000, true)

      const cycleCount =
        state.phase === 'focus'
          ? state.cycleCount + 1
          : state.phase === 'long_break'
            ? 0
            : state.cycleCount

      const upcoming = nextPhase(state.phase, cycleCount, durations)
      const base = { ...state, cycleCount }

      return {
        state: shouldAutoStart(upcoming, durations)
          ? begin(base, upcoming, endedAtMs, durations)
          : idleOn(base, upcoming, durations),
        session,
      }
    }
  }
}
