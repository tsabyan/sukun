'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Moon, Plus, Sun, SunMedium } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PlannerRow } from './PlannerRow'
import { BLOCK_LABEL } from '@/lib/planner/autoplan'
import { DAYLIGHT_TINTS } from '@/components/shell/DaylightLayer'
import type { DayBlock, Task } from '@/lib/db/types'

/**
 * The same Daylight palette that tints the app background tints these
 * headers, so Morning / Afternoon / Evening are distinguishable without
 * inventing a third colour language — docs/04-design-system.md §1.
 */
const BLOCK_TINT: Record<DayBlock, string> = {
  morning: DAYLIGHT_TINTS.dawn,
  afternoon: DAYLIGHT_TINTS.day,
  evening: DAYLIGHT_TINTS.dusk,
}

const BLOCK_ICON = { morning: Sun, afternoon: SunMedium, evening: Moon } as const

interface BlockSectionProps {
  block: DayBlock
  tasks: Task[]
  onToggle: (task: Task) => void
  onAdd: (block: DayBlock) => void
}

export function BlockSection({ block, tasks, onToggle, onAdd }: BlockSectionProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `block:${block}` })
  const Icon = BLOCK_ICON[block]
  const { name, range } = BLOCK_LABEL[block]

  return (
    <section className="flex flex-col gap-2">
      <header
        className="flex items-center gap-2.5 rounded-md px-3 py-2"
        style={{ background: BLOCK_TINT[block] }}
      >
        <Icon size={16} strokeWidth={1.75} className="text-ink-2" aria-hidden />
        <span className="eyebrow text-ink-2">{name}</span>
        <span className="text-body-sm text-ink-3">{range}</span>
        <span className="ml-auto text-body-sm tabular-nums text-ink-3">{tasks.length}</span>
      </header>

      <Card
        ref={setNodeRef}
        padding="none"
        className={
          isOver
            ? 'overflow-hidden ring-2 ring-accent transition-shadow'
            : 'overflow-hidden transition-shadow'
        }
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="inset-divider min-h-[52px]">
            {tasks.length === 0 ? (
              <li className="flex min-h-[52px] items-center px-4 text-body-sm text-ink-3">
                Nothing here yet
              </li>
            ) : (
              tasks.map((task) => (
                <PlannerRow key={task.id} task={task} onToggle={onToggle} />
              ))
            )}
          </ul>
        </SortableContext>

        <button
          type="button"
          onClick={() => onAdd(block)}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 border-t border-hairline text-label text-accent transition-colors hover:bg-surface-raised"
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
          Add task
        </button>
      </Card>
    </section>
  )
}
