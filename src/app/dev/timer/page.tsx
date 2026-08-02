'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, SectionLabel } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { useTimerStore } from '@/lib/timer/store'
import { SOUNDS, previewSound } from '@/lib/timer/audio'
import {
  notificationState,
  requestNotificationPermission,
  type PermissionState,
} from '@/lib/timer/notifications'
import { db } from '@/lib/db/schema'

/**
 * Manual harness for the parts of Phase 2 that Node tests cannot reach: the
 * Web Worker tick, audio unlocking, notifications, and the visibility
 * handlers. The logic itself is covered in machine.test.ts and store.test.ts.
 */

function mmss(ms: number) {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function DevTimerPage() {
  const runtime = useTimerStore((s) => s.runtime)
  const remaining = useTimerStore((s) => s.remainingMs)
  const hydrated = useTimerStore((s) => s.hydrated)
  const durations = useTimerStore((s) => s.durations)
  const soundId = useTimerStore((s) => s.soundId)
  const volume = useTimerStore((s) => s.volume)
  const { start, pause, resume, skip, reset } = useTimerStore.getState()

  // Read after mount without an effect, so the server render and the first
  // client render agree and no setState lands in an effect body.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [granted, setGranted] = useState<PermissionState | null>(null)
  const permission: PermissionState = granted ?? (mounted ? notificationState() : 'default')

  const [sessionCount, setSessionCount] = useState(0)
  const [lastHidden, setLastHidden] = useState<string>('—')

  useEffect(() => {
    const refresh = () => void db.sessions.count().then(setSessionCount)
    refresh()
    const id = setInterval(refresh, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let hiddenAt = 0
    const onChange = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt) setLastHidden(`${Math.round((Date.now() - hiddenAt) / 1000)}s`)
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return <p className="pt-24 text-center text-body text-ink-2">Not available.</p>
  }

  const rows: Array<[string, string]> = [
    ['phase', runtime.phase],
    ['status', runtime.status],
    ['remaining', mmss(remaining)],
    ['remaining (ms)', String(remaining)],
    ['startedAt', runtime.startedAt ? new Date(runtime.startedAt).toLocaleTimeString() : '—'],
    ['endsAt', runtime.endsAt ? new Date(runtime.endsAt).toLocaleTimeString() : '—'],
    ['plannedDurationSec', String(runtime.plannedDurationSec)],
    ['cycleCount', `${runtime.cycleCount} of ${durations.sessionsUntilLongBreak}`],
    ['taskId', runtime.taskId ?? '—'],
    ['hydrated', String(hydrated)],
    ['sessions in db', String(sessionCount)],
    ['last time hidden', lastHidden],
  ]

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <h1 className="text-title-l font-display text-ink">Timer harness</h1>
        <p className="mt-1 text-body text-ink-2">
          Background the tab for a few minutes and come back. The remainder should
          be right to the second, and a phase that ended while you were away should
          appear as one session with its true end time.
        </p>
      </div>

      <div className="numerals text-display-l text-ink">{mmss(remaining)}</div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={runtime.status === 'running' ? pause : runtime.status === 'paused' ? resume : start}>
          {runtime.status === 'running' ? 'Pause' : runtime.status === 'paused' ? 'Resume' : 'Start'}
        </Button>
        <Button onClick={skip}>Skip</Button>
        <Button onClick={reset}>Reset</Button>
      </div>

      <Card>
        <SectionLabel className="mb-2">Runtime</SectionLabel>
        <dl className="grid grid-cols-2 gap-y-1 text-body-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-2">{label}</dt>
              <dd className="text-right tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <SectionLabel className="mb-2">Alerts</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          {SOUNDS.map((sound) => (
            <Button
              key={sound.id}
              size="sm"
              variant={sound.id === soundId ? 'primary' : 'secondary'}
              onClick={() => previewSound(sound.id, volume)}
            >
              {sound.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Pill tone={permission === 'granted' ? 'accent' : 'neutral'}>
            notifications: {permission}
          </Pill>
          {permission === 'default' && (
            <Button
              size="sm"
              onClick={() => void requestNotificationPermission().then(setGranted)}
            >
              Request permission
            </Button>
          )}
        </div>
      </Card>

      <Card padding="compact">
        <p className="text-body-sm text-ink-2">
          Set a short focus length at{' '}
          <code className="text-ink">window.__repo.updateSettings({'{'} focusMinutes: 1 {'}'})</code>{' '}
          then reload, to test completion without waiting 25 minutes.
        </p>
      </Card>
    </div>
  )
}
