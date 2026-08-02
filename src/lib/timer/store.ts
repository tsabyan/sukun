import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  initialRuntime,
  reduce,
  remainingMs as computeRemaining,
  type Durations,
  type SessionOutcome,
  type TimerEvent,
  type TimerRuntime,
} from './machine'
import { playAlert, resumeAudioIfNeeded, unlockAudio } from './audio'
import { notifyPhaseEnd } from './notifications'
import { getMeta, META_KEYS, setMeta } from '@/lib/db/schema'
import { evaluateAchievements, getSettings, getTask, recordSession } from '@/lib/db/repo'
import { achievementByKey, DEFAULT_SETTINGS } from '@/lib/db/seed'
import { toast } from '@/components/ui/Toast'
import { toLocalDate } from '@/lib/utils/dates'
import { haptic, setHapticsEnabled } from '@/lib/utils/haptics'
import type { Settings } from '@/lib/db/types'

/**
 * The timer as the app sees it. Everything interesting happens in
 * ./machine.ts; this layer wires that pure reducer to persistence, the tick
 * source, and the alert stack.
 *
 * Only `remainingMs` changes every second, so subscribe to it narrowly —
 * `useTimerRemaining()` — and the countdown digits become the only thing that
 * re-renders while a session runs.
 */

function durationsFrom(settings: Settings | typeof DEFAULT_SETTINGS): Durations {
  return {
    focus: settings.focusMinutes * 60,
    shortBreak: settings.shortBreakMinutes * 60,
    longBreak: settings.longBreakMinutes * 60,
    sessionsUntilLongBreak: settings.sessionsUntilLongBreak,
    autoStartBreaks: settings.autoStartBreaks,
    autoStartFocus: settings.autoStartFocus,
  }
}

const FALLBACK_DURATIONS = durationsFrom(DEFAULT_SETTINGS)

interface TimerState {
  runtime: TimerRuntime
  remainingMs: number
  durations: Durations
  soundId: string
  volume: number
  /** transient: silences the chime for this sitting without editing settings */
  muted: boolean
  hydrated: boolean
  /** shown under the countdown; kept here so the ring needs no extra query */
  attachedTaskTitle: string | null

  hydrate: () => Promise<void>
  refreshSettings: () => Promise<void>
  start: () => void
  pause: () => void
  resume: () => void
  toggle: () => void
  reset: () => void
  skip: () => void
  attachTask: (taskId: string | null, title?: string | null) => void
  toggleMuted: () => void
  tick: () => void
}

/* ------------------------------------------------------------ side effects */

let alarm: ReturnType<typeof setTimeout> | null = null
let worker: Worker | null = null
let listenersBound = false
/** Serialises session writes so two fast transitions cannot interleave. */
let writeChain: Promise<unknown> = Promise.resolve()

function clearAlarm() {
  if (alarm !== null) {
    clearTimeout(alarm)
    alarm = null
  }
}

/**
 * A main-thread alarm at exactly `endsAt`, on top of the worker tick. The
 * worker catches the case where this gets throttled; this catches the case
 * where the worker is slow to be scheduled. Neither alone is reliable.
 */
function scheduleAlarm(state: TimerRuntime) {
  clearAlarm()
  if (state.status !== 'running' || state.endsAt === null) return

  const delay = Math.max(0, state.endsAt - Date.now())
  alarm = setTimeout(() => {
    alarm = null
    useTimerStore.getState().tick()
  }, delay)
}

function ensureWorker() {
  if (worker || typeof Worker === 'undefined') return worker
  try {
    worker = new Worker(new URL('../../workers/ticker.ts', import.meta.url))
    worker.onmessage = () => useTimerStore.getState().tick()
  } catch {
    // No worker available (very old browser, or a hostile CSP). The alarm and
    // the visibility handlers still drive completion; only the smooth
    // per-second update is lost.
    worker = null
  }
  return worker
}

function setWorkerRunning(running: boolean) {
  const w = ensureWorker()
  w?.postMessage(running ? 'start' : 'stop')
}

function persist(runtime: TimerRuntime) {
  writeChain = writeChain
    .then(() => setMeta(META_KEYS.timerRuntime, runtime))
    .catch(() => {})
}

/**
 * Unlocks are announced with one quiet toast each — no modal, no confetti.
 * Evaluated only after a completed focus session, since nothing else can move
 * the needle on any badge.
 */
async function announceAchievements() {
  const unlocked = await evaluateAchievements()
  for (const key of unlocked) {
    const badge = achievementByKey(key)
    if (badge) toast(`${badge.name} unlocked`)
  }
}

function saveSession(outcome: SessionOutcome) {
  writeChain = writeChain
    .then(() =>
      recordSession({
        taskId: outcome.taskId,
        mode: outcome.mode,
        plannedDurationSec: outcome.plannedDurationSec,
        actualDurationSec: outcome.actualDurationSec,
        startedAt: new Date(outcome.startedAtMs).toISOString(),
        endedAt: new Date(outcome.endedAtMs).toISOString(),
        // The local day of the moment it STARTED — a session begun at 23:50
        // belongs to that day, not to tomorrow.
        localDate: toLocalDate(outcome.startedAtMs),
        completed: outcome.completed,
        interrupted: outcome.interrupted,
      }),
    )
    .then(() => {
      if (outcome.mode === 'focus' && outcome.completed) return announceAchievements()
    })
    .catch((error) => {
      console.error('[sukun] failed to record session', error)
    })
}

/* ------------------------------------------------------------------ store */

export const useTimerStore = create<TimerState>((set, get) => {
  /** The single funnel. Every state change in the app goes through here. */
  function dispatch(event: TimerEvent, options: { alert?: boolean } = {}) {
    const { runtime } = get()
    const result = reduce(runtime, event)
    if (result.state === runtime && !result.session) return

    let next = result.state

    // Catch-up guard: complete at most one phase per return. If auto-start
    // handed us a phase whose clock has already run out, the user was not here
    // for it — drop to idle rather than fabricating a chain of sessions they
    // never sat through.
    if (next.status === 'running' && next.endsAt !== null && next.endsAt <= Date.now()) {
      next = {
        ...next,
        status: 'idle',
        startedAt: null,
        endsAt: null,
        pausedAt: null,
      }
    }

    set({ runtime: next, remainingMs: computeRemaining(next, Date.now()) })
    persist(next)
    scheduleAlarm(next)
    setWorkerRunning(next.status === 'running')

    if (result.session) {
      saveSession(result.session)

      if (options.alert && result.session.completed) {
        const { soundId, volume, muted, attachedTaskTitle } = get()
        if (!muted) playAlert(soundId, volume)
        haptic('phaseComplete')
        notifyPhaseEnd(result.session.mode, attachedTaskTitle)
      }
    }
  }

  return {
    runtime: initialRuntime(FALLBACK_DURATIONS),
    remainingMs: FALLBACK_DURATIONS.focus * 1000,
    durations: FALLBACK_DURATIONS,
    soundId: DEFAULT_SETTINGS.soundId,
    volume: DEFAULT_SETTINGS.volume,
    muted: false,
    hydrated: false,
    attachedTaskTitle: null,

    async hydrate() {
      if (get().hydrated) return

      const settings = await getSettings()
      const durations = durationsFrom(settings)
      setHapticsEnabled(settings.hapticsEnabled)
      const stored = await getMeta<TimerRuntime>(META_KEYS.timerRuntime)

      const runtime = stored ?? initialRuntime(durations)

      // Only the id is persisted, so the title has to be looked back up —
      // otherwise the ring loses its subtitle on every reload.
      let attachedTaskTitle: string | null = null
      if (runtime.taskId) {
        attachedTaskTitle = (await getTask(runtime.taskId))?.title ?? null
      }

      set({
        runtime,
        durations,
        soundId: settings.soundId,
        volume: settings.volume,
        remainingMs: computeRemaining(runtime, Date.now()),
        attachedTaskTitle,
        hydrated: true,
      })

      // A phase that finished while the tab was gone completes now, but is
      // recorded with its true end time. No alert — the moment has passed and
      // a chime for something that ended an hour ago is a lie.
      if (runtime.status === 'running' && runtime.endsAt !== null && runtime.endsAt <= Date.now()) {
        dispatch({ type: 'COMPLETE', now: Date.now(), durations }, { alert: false })
      } else {
        scheduleAlarm(runtime)
        setWorkerRunning(runtime.status === 'running')
      }
    },

    async refreshSettings() {
      const settings = await getSettings()
      setHapticsEnabled(settings.hapticsEnabled)
      set({
        durations: durationsFrom(settings),
        soundId: settings.soundId,
        volume: settings.volume,
      })
      // An idle timer should show the new duration straight away.
      const { runtime } = get()
      if (runtime.status === 'idle') {
        dispatch({ type: 'RESET', now: Date.now(), durations: durationsFrom(settings) })
      }
    },

    start() {
      unlockAudio() // must happen inside the gesture, or iOS stays silent
      dispatch({ type: 'START', now: Date.now(), durations: get().durations })
    },

    pause() {
      dispatch({ type: 'PAUSE', now: Date.now() })
    },

    resume() {
      unlockAudio()
      dispatch({ type: 'RESUME', now: Date.now() })
    },

    toggle() {
      const { runtime, start, pause, resume } = get()
      if (runtime.status === 'running') pause()
      else if (runtime.status === 'paused') resume()
      else start()
    },

    reset() {
      dispatch({ type: 'RESET', now: Date.now(), durations: get().durations })
    },

    skip() {
      dispatch({ type: 'SKIP', now: Date.now(), durations: get().durations })
    },

    attachTask(taskId, title = null) {
      dispatch({ type: 'ATTACH_TASK', taskId })
      set({ attachedTaskTitle: taskId ? title : null })
    },

    toggleMuted() {
      set({ muted: !get().muted })
    },

    tick() {
      const { runtime, durations } = get()
      if (runtime.status !== 'running') return

      const now = Date.now()
      const remaining = computeRemaining(runtime, now)

      if (remaining <= 0) {
        dispatch({ type: 'COMPLETE', now, durations }, { alert: true })
        return
      }
      if (remaining !== get().remainingMs) set({ remainingMs: remaining })
    },
  }
})

/* --------------------------------------------------------------- lifecycle */

/**
 * Recompute triggers beyond the worker — all three are mandatory.
 * `pageshow` is the one people forget: it covers bfcache restore, where no
 * other event fires and the countdown would otherwise resume stale.
 */
export function bindTimerListeners(): () => void {
  if (listenersBound || typeof window === 'undefined') return () => {}
  listenersBound = true

  const recompute = () => {
    resumeAudioIfNeeded()
    useTimerStore.getState().tick()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') recompute()
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', recompute)
  window.addEventListener('pageshow', recompute)

  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', recompute)
    window.removeEventListener('pageshow', recompute)
    clearAlarm()
    worker?.terminate()
    worker = null
    listenersBound = false
  }
}

/**
 * Test seam. The store is a module singleton, which is right for the app and
 * awkward for tests — this puts it back to a cold start so "reload the page"
 * can actually be exercised.
 */
export function resetTimerStoreForTests() {
  clearAlarm()
  writeChain = Promise.resolve()
  useTimerStore.setState({
    runtime: initialRuntime(FALLBACK_DURATIONS),
    remainingMs: FALLBACK_DURATIONS.focus * 1000,
    durations: FALLBACK_DURATIONS,
    soundId: DEFAULT_SETTINGS.soundId,
    volume: DEFAULT_SETTINGS.volume,
    hydrated: false,
    attachedTaskTitle: null,
  })
}

/** Lets tests await the persistence and session writes. */
export function flushTimerWrites(): Promise<unknown> {
  return writeChain
}

/* --------------------------------------------------------------- selectors */

/** Subscribe here and nowhere else for the countdown — it changes every tick. */
export const useTimerRemaining = () => useTimerStore((s) => s.remainingMs)

export const useTimerPhase = () => useTimerStore((s) => s.runtime.phase)
export const useTimerStatus = () => useTimerStore((s) => s.runtime.status)
export const useTimerHydrated = () => useTimerStore((s) => s.hydrated)

export const useTimerControls = () =>
  useTimerStore(
    useShallow((s) => ({
      start: s.start,
      pause: s.pause,
      resume: s.resume,
      toggle: s.toggle,
      reset: s.reset,
      skip: s.skip,
      attachTask: s.attachTask,
    })),
  )

/** 0 → just started, 1 → finished. Drives the ring. */
export function progressFraction(state = useTimerStore.getState()): number {
  const total = state.runtime.plannedDurationSec * 1000
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, 1 - state.remainingMs / total))
}
