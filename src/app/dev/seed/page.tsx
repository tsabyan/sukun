'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, SectionLabel } from '@/components/ui/Card'
import { seedDevData, type SeedResult } from '@/lib/db/dev-seed'
import { deleteAllData, countActiveTasks, getStreaks, getDayStats } from '@/lib/db/repo'
import { formatDuration } from '@/lib/utils/dates'

type Status = 'idle' | 'working' | 'done' | 'error'

export default function DevSeedPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<SeedResult | null>(null)
  const [summary, setSummary] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="pt-24 text-center">
        <p className="text-body text-ink-2">Not available.</p>
      </div>
    )
  }

  const run = async (fn: () => Promise<void>) => {
    setStatus('working')
    setError(null)
    try {
      await fn()
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  const handleSeed = () =>
    run(async () => {
      const seeded = await seedDevData()
      setResult(seeded)

      const [active, streaks, day] = await Promise.all([
        countActiveTasks(),
        getStreaks(),
        getDayStats(),
      ])
      setSummary([
        `${active} active tasks`,
        `current streak ${streaks.current} · longest ${streaks.longest}`,
        `today: ${day.sessions} sessions · ${formatDuration(day.focusSeconds)}`,
      ])
    })

  const handleWipe = () =>
    run(async () => {
      await deleteAllData()
      setResult(null)
      setSummary([])
    })

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <h1 className="text-title-l font-display text-ink">Dev fixtures</h1>
        <p className="mt-1 text-body text-ink-2">
          Seeds 15 tasks, their subtasks and tags, and 90 days of focus sessions into
          IndexedDB. The generator is seeded, so every run produces the same data.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={handleSeed} disabled={status === 'working'}>
          {status === 'working' ? 'Working…' : 'Seed 90 days'}
        </Button>
        <Button variant="destructive" onClick={handleWipe} disabled={status === 'working'}>
          Delete all data
        </Button>
      </div>

      {error && (
        <Card className="border-ember/40">
          <SectionLabel className="mb-1">Failed</SectionLabel>
          <p className="text-body-sm text-ember">{error}</p>
        </Card>
      )}

      {result && (
        <Card>
          <SectionLabel className="mb-2">Written</SectionLabel>
          <dl className="grid grid-cols-2 gap-y-1 text-body-sm">
            {[
              ['Tasks', result.tasks],
              ['Subtasks', result.subtasks],
              ['Tags', result.tags],
              ['Sessions', result.sessions],
              ['Days covered', result.days],
            ].map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-2">{label}</dt>
                <dd className="text-right tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {summary.length > 0 && (
        <Card>
          <SectionLabel className="mb-2">Read back</SectionLabel>
          <ul className="flex flex-col gap-1 text-body-sm text-ink-2">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card padding="compact">
        <p className="text-body-sm text-ink-2">
          <code className="text-ink">window.__repo</code> and{' '}
          <code className="text-ink">window.__db</code> are available in the console.
        </p>
      </Card>
    </div>
  )
}
