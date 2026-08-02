import { describe, expect, it } from 'vitest'
import {
  elapsedMs,
  initialRuntime,
  nextPhase,
  phaseDuration,
  reduce,
  remainingMs,
  type Durations,
  type TimerRuntime,
} from './machine'

/**
 * The seven invariants from docs/06-data-contracts.md §2, plus the edges they
 * imply. These encode the contract — if a change breaks one of these, the
 * change is wrong, not the test.
 */

const D: Durations = {
  focus: 1500, // 25m
  shortBreak: 300, // 5m
  longBreak: 900, // 15m
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
}

const T0 = 1_800_000_000_000 // a fixed epoch; no wall clock anywhere in here
const MIN = 60_000

const auto = (over: Partial<Durations> = {}): Durations => ({
  ...D,
  autoStartBreaks: true,
  autoStartFocus: true,
  ...over,
})

/** Start a focus phase at T0 and hand back the running state. */
function running(durations: Durations = D, at = T0): TimerRuntime {
  return reduce(initialRuntime(durations), { type: 'START', now: at, durations }).state
}

/* ============================================ invariant 1: never negative */

describe('invariant 1 — remaining time never goes negative', () => {
  it('clamps at zero long after the phase ended', () => {
    const state = running()
    expect(remainingMs(state, T0 + 25 * MIN)).toBe(0)
    expect(remainingMs(state, T0 + 90 * MIN)).toBe(0)
    expect(remainingMs(state, T0 + 24 * 60 * MIN)).toBe(0)
  })

  it('reports the full duration while idle', () => {
    expect(remainingMs(initialRuntime(D), T0)).toBe(1500 * 1000)
  })

  it('counts down from the finish line, not from a stored counter', () => {
    const state = running()
    expect(remainingMs(state, T0)).toBe(1500 * 1000)
    expect(remainingMs(state, T0 + 10 * MIN)).toBe(15 * MIN)
  })
})

/* ================================== invariant 2: pause shifts endsAt exactly */

describe('invariant 2 — pause then resume shifts endsAt by exactly the pause', () => {
  it('moves the finish line by the paused duration', () => {
    const started = running()
    const paused = reduce(started, { type: 'PAUSE', now: T0 + 5 * MIN }).state
    const resumed = reduce(paused, { type: 'RESUME', now: T0 + 8 * MIN }).state

    expect(resumed.endsAt).toBe(started.endsAt! + 3 * MIN)
    expect(resumed.pausedAt).toBeNull()
    expect(resumed.status).toBe('running')
  })

  it('holds the remaining time steady while paused', () => {
    const paused = reduce(running(), { type: 'PAUSE', now: T0 + 5 * MIN }).state

    expect(remainingMs(paused, T0 + 5 * MIN)).toBe(20 * MIN)
    expect(remainingMs(paused, T0 + 45 * MIN)).toBe(20 * MIN)
  })

  it('survives repeated pause and resume without losing time', () => {
    let state = running()
    for (let i = 1; i <= 5; i++) {
      state = reduce(state, { type: 'PAUSE', now: T0 + i * 2 * MIN }).state
      state = reduce(state, { type: 'RESUME', now: T0 + i * 2 * MIN + MIN }).state
    }
    // five one-minute pauses
    expect(state.endsAt).toBe(T0 + 1500 * 1000 + 5 * MIN)
  })

  it('ignores pause when not running and resume when not paused', () => {
    const idle = initialRuntime(D)
    expect(reduce(idle, { type: 'PAUSE', now: T0 }).state).toEqual(idle)

    const started = running()
    expect(reduce(started, { type: 'RESUME', now: T0 + MIN }).state).toEqual(started)
  })
})

/* ============================ invariant 3: completion uses the real end time */

describe('invariant 3 — completing late records endsAt, not the wake-up time', () => {
  it('records the historical end time when the tab returns 40 minutes late', () => {
    const state = running()
    const { session } = reduce(state, { type: 'COMPLETE', now: T0 + 65 * MIN, durations: D })

    expect(session).toBeDefined()
    expect(session!.endedAtMs).toBe(state.endsAt)
    expect(session!.endedAtMs).toBe(T0 + 25 * MIN)
    expect(session!.actualDurationSec).toBe(1500)
    expect(session!.completed).toBe(true)
    expect(session!.interrupted).toBe(false)
  })

  it('never reports more elapsed time than the phase actually ran', () => {
    const state = running()
    const { session } = reduce(state, { type: 'COMPLETE', now: T0 + 12 * 60 * MIN, durations: D })
    expect(session!.actualDurationSec).toBeLessThanOrEqual(D.focus)
  })

  it('does nothing when there is no phase in flight', () => {
    const idle = initialRuntime(D)
    const result = reduce(idle, { type: 'COMPLETE', now: T0, durations: D })
    expect(result.session).toBeUndefined()
    expect(result.state).toEqual(idle)
  })
})

/* ================================= invariant 4: skip records the real elapsed */

describe('invariant 4 — skipping records what was actually spent', () => {
  it('marks the session interrupted with the true elapsed time', () => {
    const state = running()
    const { session } = reduce(state, { type: 'SKIP', now: T0 + 7 * MIN, durations: D })

    expect(session!.completed).toBe(false)
    expect(session!.interrupted).toBe(true)
    expect(session!.actualDurationSec).toBe(7 * 60)
    expect(session!.plannedDurationSec).toBe(1500)
  })

  it('excludes paused time from the elapsed total', () => {
    let state = running()
    state = reduce(state, { type: 'PAUSE', now: T0 + 5 * MIN }).state
    state = reduce(state, { type: 'RESUME', now: T0 + 15 * MIN }).state

    // 5 minutes of work, 10 paused, then 2 more minutes of work
    const { session } = reduce(state, { type: 'SKIP', now: T0 + 17 * MIN, durations: D })
    expect(session!.actualDurationSec).toBe(7 * 60)
  })

  it('measures to the pause point when skipping while paused', () => {
    let state = running()
    state = reduce(state, { type: 'PAUSE', now: T0 + 6 * MIN }).state

    const { session } = reduce(state, { type: 'SKIP', now: T0 + 40 * MIN, durations: D })
    expect(session!.actualDurationSec).toBe(6 * 60)
  })

  it('records nothing for a phase that never ran', () => {
    const started = running()
    const { session } = reduce(started, { type: 'SKIP', now: T0, durations: D })
    expect(session).toBeUndefined()
  })

  it('records a reset the same way — the time was still spent', () => {
    const state = running()
    const result = reduce(state, { type: 'RESET', now: T0 + 9 * MIN, durations: D })

    expect(result.session!.actualDurationSec).toBe(9 * 60)
    expect(result.session!.interrupted).toBe(true)
    // reset restarts the same phase rather than advancing
    expect(result.state.phase).toBe('focus')
    expect(result.state.status).toBe('idle')
  })
})

/* ================================================ invariant 5: cycle counting */

describe('invariant 5 — only a completed focus phase earns a cycle', () => {
  it('increments on completion and resets after the long break', () => {
    const phases: string[] = []

    // four focus/break pairs, auto-started so the chain runs itself
    const durations = auto()
    let state = reduce(initialRuntime(durations), {
      type: 'START',
      now: T0,
      durations,
    }).state

    let clock = T0
    for (let i = 0; i < 8; i++) {
      clock += phaseDuration(state.phase, durations) * 1000
      const result = reduce(state, { type: 'COMPLETE', now: clock, durations })
      state = result.state
      phases.push(state.phase)
    }

    expect(phases).toEqual([
      'short_break',
      'focus',
      'short_break',
      'focus',
      'short_break',
      'focus',
      'long_break', // fourth focus
      'focus',
    ])
    expect(state.cycleCount).toBe(0) // reset by the long break
  })

  it('does not increment when a focus phase is skipped', () => {
    const state = running()
    const skipped = reduce(state, { type: 'SKIP', now: T0 + 3 * MIN, durations: D }).state
    expect(skipped.cycleCount).toBe(0)
    expect(skipped.phase).toBe('short_break')
  })

  it('does not increment when a break completes', () => {
    let state = reduce(running(), { type: 'COMPLETE', now: T0 + 25 * MIN, durations: D }).state
    expect(state.cycleCount).toBe(1)

    state = reduce(state, { type: 'START', now: T0 + 25 * MIN, durations: D }).state
    state = reduce(state, { type: 'COMPLETE', now: T0 + 30 * MIN, durations: D }).state
    expect(state.cycleCount).toBe(1)
  })

  it('picks the long break on the configured multiple', () => {
    expect(nextPhase('focus', 4, D)).toBe('long_break')
    expect(nextPhase('focus', 8, D)).toBe('long_break')
    expect(nextPhase('focus', 3, D)).toBe('short_break')
    expect(nextPhase('focus', 0, D)).toBe('short_break')
    expect(nextPhase('short_break', 2, D)).toBe('focus')
    expect(nextPhase('long_break', 4, D)).toBe('focus')
  })
})

/* ===================================== invariant 6: breaks are still recorded */

describe('invariant 6 — break phases are recorded, and marked as breaks', () => {
  it('emits a session for a completed break', () => {
    let state = reduce(running(), { type: 'COMPLETE', now: T0 + 25 * MIN, durations: D }).state
    expect(state.phase).toBe('short_break')

    state = reduce(state, { type: 'START', now: T0 + 25 * MIN, durations: D }).state
    const { session } = reduce(state, {
      type: 'COMPLETE',
      now: T0 + 30 * MIN,
      durations: D,
    })

    expect(session!.mode).toBe('short_break')
    expect(session!.actualDurationSec).toBe(300)
  })
})

/* ================================== invariant 7: start is not a restart */

describe('invariant 7 — start on a live timer is a no-op', () => {
  it('leaves a running timer untouched', () => {
    const state = running()
    const again = reduce(state, { type: 'START', now: T0 + 10 * MIN, durations: D }).state
    expect(again).toEqual(state)
    expect(again.startedAt).toBe(T0)
  })

  it('leaves a paused timer untouched — resuming is explicit', () => {
    const paused = reduce(running(), { type: 'PAUSE', now: T0 + 5 * MIN }).state
    const again = reduce(paused, { type: 'START', now: T0 + 6 * MIN, durations: D }).state
    expect(again).toEqual(paused)
  })
})

/* ------------------------------------------------------------ auto-advance */

describe('auto-start', () => {
  it('runs the next phase straight from the true end time', () => {
    const durations = auto()
    const state = running(durations)
    const next = reduce(state, { type: 'COMPLETE', now: T0 + 40 * MIN, durations }).state

    expect(next.status).toBe('running')
    expect(next.phase).toBe('short_break')
    // begins when focus actually ended, not when we noticed
    expect(next.startedAt).toBe(T0 + 25 * MIN)
    expect(next.endsAt).toBe(T0 + 30 * MIN)
  })

  it('honours the two toggles independently', () => {
    const breaksOnly = { ...D, autoStartBreaks: true, autoStartFocus: false }
    const afterFocus = reduce(running(breaksOnly), {
      type: 'COMPLETE',
      now: T0 + 25 * MIN,
      durations: breaksOnly,
    }).state
    expect(afterFocus.status).toBe('running')

    const started = reduce(afterFocus, { type: 'COMPLETE', now: T0 + 30 * MIN, durations: breaksOnly })
    expect(started.state.phase).toBe('focus')
    expect(started.state.status).toBe('idle')
  })
})

/* ---------------------------------------------------------------- the rest */

describe('task attachment', () => {
  it('travels onto the recorded session', () => {
    let state = initialRuntime(D)
    state = reduce(state, { type: 'ATTACH_TASK', taskId: 'task-1' }).state
    state = reduce(state, { type: 'START', now: T0, durations: D }).state

    const { session } = reduce(state, { type: 'COMPLETE', now: T0 + 25 * MIN, durations: D })
    expect(session!.taskId).toBe('task-1')
  })

  it('can be cleared at any point', () => {
    let state = reduce(initialRuntime(D), { type: 'ATTACH_TASK', taskId: 'task-1' }).state
    state = reduce(state, { type: 'ATTACH_TASK', taskId: null }).state
    expect(state.taskId).toBeNull()
  })
})

describe('settings changed mid-session', () => {
  it('measures against the duration the phase started with', () => {
    const state = running() // 25 minutes
    const longer: Durations = { ...D, focus: 3000 } // user switches to 50

    const { session } = reduce(state, { type: 'SKIP', now: T0 + 10 * MIN, durations: longer })
    expect(session!.plannedDurationSec).toBe(1500)
    expect(session!.actualDurationSec).toBe(10 * 60)
  })

  it('applies the new duration to the next phase', () => {
    const state = running()
    const shorter: Durations = { ...D, shortBreak: 600 }
    const next = reduce(state, { type: 'COMPLETE', now: T0 + 25 * MIN, durations: shorter }).state
    expect(next.plannedDurationSec).toBe(600)
  })
})

describe('elapsed', () => {
  it('is zero before anything starts', () => {
    expect(elapsedMs(initialRuntime(D), T0)).toBe(0)
  })

  it('never exceeds the planned duration', () => {
    const state = running()
    expect(elapsedMs(state, T0 + 99 * MIN)).toBe(1500 * 1000)
  })
})

describe('reset', () => {
  it('from idle just restores the phase duration', () => {
    const idle = initialRuntime(D)
    const result = reduce(idle, { type: 'RESET', now: T0, durations: D })
    expect(result.session).toBeUndefined()
    expect(result.state.plannedDurationSec).toBe(1500)
  })

  it('keeps the cycle count — the phase is retried, not forfeited', () => {
    let state = reduce(running(), { type: 'COMPLETE', now: T0 + 25 * MIN, durations: D }).state
    expect(state.cycleCount).toBe(1)

    state = reduce(state, { type: 'START', now: T0 + 25 * MIN, durations: D }).state
    state = reduce(state, { type: 'RESET', now: T0 + 27 * MIN, durations: D }).state
    expect(state.cycleCount).toBe(1)
  })
})
