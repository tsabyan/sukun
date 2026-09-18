'use client'

import { useState } from 'react'
import { useDevOpen } from '@/lib/dev/state'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/Button'
import { BlockSection } from '@/components/planner/BlockSection'
import { PlannerRow } from '@/components/planner/PlannerRow'
import { TaskFormSheet } from '@/components/tasks/TaskFormSheet'
import { BLOCKS } from '@/lib/planner/autoplan'
import { completeTask, listPlanned, reopenTask, setPlacement } from '@/lib/db/repo'
import { addDays, fromLocalDate, today } from '@/lib/utils/dates'
import type { DayBlock, Task } from '@/lib/db/types'

/** How far either way the date arrows will go — docs/05-screens.md B8. */
const DATE_RANGE = 7

/**
 * S2 — the Daily Planner.
 *
 * A timed plan is the gap between intent and follow-through. This screen is
 * the only place a flat list turns into a shape for the day.
 */
export default function PlanPage() {
  const router = useRouter()
  const [date, setDate] = useState(today())
  const [dragging, setDragging] = useState<Task | null>(null)
  const [addTo, setAddTo] = useState<DayBlock | null>(null)

  const planned = useLiveQuery(() => listPlanned(date), [date])

  useDevOpen('plan-add', () => setAddTo('morning'))

  const sensors = useSensors(
    // A short delay lets a tap still be a tap; without it every scroll
    // attempt on a touch screen picks up a row instead.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const offset = Math.round(
    (fromLocalDate(date).getTime() - fromLocalDate(today()).getTime()) / 86_400_000,
  )

  const tasks = planned ?? []
  const byBlock = (block: DayBlock) => tasks.filter((task) => task.plannedBlock === block)
  const doneCount = tasks.filter((task) => task.status === 'completed').length

  const handleToggle = async (task: Task) => {
    if (task.status === 'completed') {
      await reopenTask(task.id)
      return
    }
    await completeTask(task.id)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDragging(tasks.find((task) => task.id === event.active.id) ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragging(null)
    const { active, over } = event
    if (!over) return

    const moved = tasks.find((task) => task.id === active.id)
    if (!moved) return

    // Dropped on a block header area, or onto another row.
    const overId = String(over.id)
    const targetBlock: DayBlock | undefined = overId.startsWith('block:')
      ? (overId.slice(6) as DayBlock)
      : tasks.find((task) => task.id === overId)?.plannedBlock ?? undefined

    if (!targetBlock) return

    const siblings = byBlock(targetBlock).filter((task) => task.id !== moved.id)
    const overIndex = siblings.findIndex((task) => task.id === overId)
    const insertAt = overIndex === -1 ? siblings.length : overIndex

    const ordered = [...siblings]
    ordered.splice(insertAt, 0, moved)

    // Moving a task by hand pins it in place so a later reorder treats it as
    // a fixed point rather than shuffling it again.
    await Promise.all(
      ordered.map((task, index) =>
        setPlacement(task.id, targetBlock, index, task.id === moved.id || task.plannedManually, date),
      ),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <IconButton label="Close planner" onClick={() => router.push('/')}>
          <X size={20} strokeWidth={1.75} />
        </IconButton>

        <div className="flex items-center gap-1">
          <IconButton
            label="Previous day"
            size={36}
            disabled={offset <= -DATE_RANGE}
            onClick={() => setDate(addDays(date, -1))}
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </IconButton>

          <button
            type="button"
            onClick={() => setDate(today())}
            className="min-w-[9ch] text-center text-title-m text-ink"
          >
            {offset === 0
              ? 'Today'
              : fromLocalDate(date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
          </button>

          <IconButton
            label="Next day"
            size={36}
            disabled={offset >= DATE_RANGE}
            onClick={() => setDate(addDays(date, 1))}
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </IconButton>
        </div>
      </header>

      {tasks.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <p className="text-body text-ink-2">
            Nothing planned yet. Add tasks to a block below to shape your day.
          </p>
        </Card>
      ) : (
        <Card padding="compact" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-body text-ink">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} planned
            </span>
            <span className="text-body-sm tabular-nums text-ink-2">
              {doneCount} of {tasks.length} done
            </span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-hairline">
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${(doneCount / tasks.length) * 100}%` }}
            />
          </span>
        </Card>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={() => setDragging(null)}
      >
        <div className="flex flex-col gap-5">
          {BLOCKS.map((block) => (
            <BlockSection
              key={block}
              block={block}
              tasks={byBlock(block)}
              onToggle={handleToggle}
              onAdd={setAddTo}
            />
          ))}
        </div>

        <DragOverlay>
          {dragging && (
            <ul className="list-none">
              <PlannerRow task={dragging} onToggle={() => {}} overlay />
            </ul>
          )}
        </DragOverlay>
      </DndContext>

      <TaskFormSheet
        open={addTo !== null}
        onClose={() => setAddTo(null)}
        plannedBlock={addTo ?? undefined}
        plannedDate={date}
      />
    </div>
  )
}
