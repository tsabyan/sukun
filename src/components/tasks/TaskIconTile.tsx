'use client'

import { createElement } from 'react'
import { taskIcon, TASK_COLOR_VAR } from '@/lib/tasks/icons'
import { cn } from '@/lib/utils/cn'
import type { TaskColor } from '@/lib/db/types'

/**
 * A task's own icon and colour — the form preview and the detail header.
 *
 * Elsewhere in a list a task uses the neutral `IconTile`, because eight
 * saturated squares down a column is noise; here the colour is the point,
 * since this is where it gets chosen and confirmed.
 */
export function TaskIconTile({
  icon,
  color,
  size = 40,
  className,
}: {
  icon: string
  color: TaskColor
  size?: number
  className?: string
}) {
  const tint = TASK_COLOR_VAR[color]

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.35),
        background: `color-mix(in oklch, ${tint} 22%, var(--surface))`,
      }}
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
    >
      {/* createElement, not <Icon />: the lint rule reads a capitalised local
          as a component defined during render. */}
      {createElement(taskIcon(icon), {
        size: Math.round(size * 0.45),
        strokeWidth: 1.75,
        style: { color: `color-mix(in oklch, ${tint} 78%, var(--text-primary))` },
      })}
    </span>
  )
}
