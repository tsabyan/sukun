'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ChipButton } from '@/components/ui/Pill'

/** Starting points, for the blank-page problem — D5. */
const SUGGESTIONS = [
  'A focused engineer',
  'An early riser',
  'Someone who moves',
  'A patient parent',
]

/** D5 — new identity. An identity is a person, not a goal, so the copy says so. */
export function NewIdentitySheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState('')

  // Reset on each opening. Deriving from a prop change during render is the
  // sanctioned pattern; an effect here would paint the old draft for a frame.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setName('')
  }

  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      snapPoints={[0.62]}
      title="New identity"
      action={
        <Button variant="primary" onClick={create} disabled={!name.trim()}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          Create
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-body text-ink-2">
          Habits hang off who you want to be. Write it as a person, not a goal.
        </p>

        <label className="flex flex-col gap-2">
          <span className="eyebrow text-ink-3">I am becoming…</span>
          <input
            value={name}
            autoFocus
            placeholder="A calm reader"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="h-13 w-full rounded-md bg-field px-4 py-3.5 text-body text-ink outline-none placeholder:text-ink-3"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="eyebrow text-ink-3">Or start from</span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <ChipButton key={suggestion} onClick={() => setName(suggestion)}>
                {suggestion}
              </ChipButton>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
