'use client'

import { useRef, useState } from 'react'
import { motion, useMotionValue, type PanInfo } from 'motion/react'
import { spring } from '@/lib/motion/tokens'
import { haptic } from '@/lib/utils/haptics'
import { cn } from '@/lib/utils/cn'

export interface SwipeAction {
  label: string
  icon: React.ReactNode
  onPress: () => void
  tone?: 'default' | 'destructive'
}

interface SwipeRowProps {
  actions: SwipeAction[]
  children: React.ReactNode
  className?: string
}

const ACTION_WIDTH = 72
const COMMIT_RATIO = 0.5

/**
 * iOS swipe-to-action, with the same actions revealed on hover for pointer
 * devices — a desktop user should never have to discover a gesture that their
 * input device cannot perform.
 *
 * Dragging past halfway and letting go fires the first action directly;
 * stopping short parks the row open so the buttons can be tapped.
 */
export function SwipeRow({ actions, children, className }: SwipeRowProps) {
  const x = useMotionValue(0)
  const [open, setOpen] = useState(false)
  const committed = useRef(false)

  const railWidth = actions.length * ACTION_WIDTH
  const maxDrag = -railWidth

  const close = () => {
    setOpen(false)
    void x.set(0)
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const dragged = info.offset.x

    if (dragged < maxDrag * COMMIT_RATIO || info.velocity.x < -600) {
      if (!committed.current) {
        committed.current = true
        haptic('dragEngaged')
      }
      setOpen(true)
      void x.set(maxDrag)
      return
    }
    committed.current = false
    close()
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className="absolute inset-y-0 right-0 flex" aria-hidden={!open}>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              action.onPress()
              close()
            }}
            style={{ width: ACTION_WIDTH }}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-[11px] font-medium',
              action.tone === 'destructive'
                ? 'bg-ember/12 text-ember'
                : 'bg-surface-sunken text-ink-2',
            )}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: maxDrag, right: 0 }}
        dragElastic={{ left: 0.05, right: 0 }}
        onDragEnd={handleDragEnd}
        transition={spring.snappy}
        animate={{ x: open ? maxDrag : 0 }}
        className="relative touch-pan-y bg-surface"
      >
        {children}
      </motion.div>
    </div>
  )
}

/**
 * Pointer-device counterpart: the same actions, revealed on hover or focus.
 * Wrap a row in this alongside SwipeRow's children.
 */
export function HoverActions({
  actions,
  className,
}: {
  actions: SwipeAction[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-y-0 right-2 hidden items-center gap-1 opacity-0',
        'transition-opacity duration-150',
        'group-hover:pointer-events-auto group-hover:opacity-100',
        'group-focus-within:pointer-events-auto group-focus-within:opacity-100',
        'sm:flex',
        className,
      )}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          aria-label={action.label}
          title={action.label}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            action.onPress()
          }}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-[10px]',
            'bg-surface-raised shadow-sm transition-colors',
            action.tone === 'destructive'
              ? 'text-ember hover:bg-ember/10'
              : 'text-ink-2 hover:text-ink',
          )}
        >
          {action.icon}
        </button>
      ))}
    </div>
  )
}
