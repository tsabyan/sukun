'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ChipButton } from '@/components/ui/Pill'
import { ALL_DAYS, DOW } from '@/lib/habits/streaks'
import { cn } from '@/lib/utils/cn'
import type { Identity } from '@/lib/db/types'

const WEEKDAYS = [1, 2, 3, 4, 5]
const WEEKENDS = [0, 6]

/** Monday-first, because the schedule row reads as a week, not as an array. */
const ORDER = [1, 2, 3, 4, 5, 6, 0]

/**
 * D6 — new habit.
 *
 * Identity first, then the name, then the days. The schedule is the part
 * people skip, so it is pre-set to weekdays and has one-tap presets under it.
 */
export function NewHabitSheet({
  open,
  onClose,
  identities,
  identityId,
  onPickIdentity,
  onAddIdentity,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  identities: Identity[]
  /** the identity the habit lands under; null until one is chosen */
  identityId: string | null
  onPickIdentity: (id: string) => void
  /** first run: there is nothing to file the habit under yet */
  onAddIdentity: () => void
  onCreate: (input: { identityId: string; name: string; schedule: number[] }) => void
}) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState<number[]>(WEEKDAYS)

  // Reset on each opening. Deriving from a prop change during render is the
  // sanctioned pattern; an effect here would paint the old draft for a frame.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName('')
      setSchedule(WEEKDAYS)
    }
  }

  const toggleDay = (day: number) => {
    setSchedule((current) => {
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day]
      // A habit scheduled on no days would never appear anywhere.
      return next.length === 0 ? [day] : next
    })
  }

  const create = () => {
    const trimmed = name.trim()
    if (!trimmed || !identityId) return
    onCreate({ identityId, name: trimmed, schedule })
    onClose()
  }

  const same = (a: number[], b: number[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      snapPoints={[0.9]}
      title="New habit"
      action={
        <Button variant="primary" onClick={create} disabled={!name.trim() || !identityId}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          Create
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-ink-2">For</span>
          {identities.length === 0 ? (
            // Was a red pill stating a fact you could not act on. A habit
            // needs an identity, so the thing that says so is the way to make
            // one — issue #6.
            <button
              type="button"
              onClick={onAddIdentity}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-field px-4 text-label text-ink"
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              Add an identity first
            </button>
          ) : (
            identities.map((identity) => (
              <ChipButton
                key={identity.id}
                selected={identity.id === identityId}
                onClick={() => onPickIdentity(identity.id)}
              >
                {identity.name || 'Untitled identity'}
              </ChipButton>
            ))
          )}
        </div>

        <label className="flex flex-col gap-2">
          <span className="eyebrow text-ink-3">Habit</span>
          <input
            value={name}
            autoFocus
            placeholder="Read one spec"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="h-13 w-full rounded-md bg-field px-4 py-3.5 text-body text-ink outline-none placeholder:text-ink-3"
          />
        </label>

        <div className="flex flex-col gap-2.5">
          <span className="eyebrow text-ink-3">Schedule</span>
          <div className="flex gap-1.5">
            {ORDER.map((day) => {
              const on = schedule.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={DOW[day]}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    'inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-md',
                    'text-label transition-colors duration-150',
                    on ? 'bg-ink text-green' : 'bg-field text-ink-2',
                  )}
                >
                  {DOW[day].charAt(0)}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <ChipButton
              selected={same(schedule, ALL_DAYS)}
              onClick={() => setSchedule(ALL_DAYS)}
            >
              Every day
            </ChipButton>
            <ChipButton
              selected={same(schedule, WEEKDAYS)}
              onClick={() => setSchedule(WEEKDAYS)}
            >
              Weekdays
            </ChipButton>
            <ChipButton
              selected={same(schedule, WEEKENDS)}
              onClick={() => setSchedule(WEEKENDS)}
            >
              Weekends
            </ChipButton>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
