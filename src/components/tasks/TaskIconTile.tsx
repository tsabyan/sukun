import { createElement } from 'react'
import { taskIcon, TASK_COLOR_VAR } from '@/lib/tasks/icons'
import type { TaskColor } from '@/lib/db/types'
import { cn } from '@/lib/utils/cn'

/**
 * A squircle, not a rounded rectangle — docs/04-design-system.md §3. The
 * continuous curve is the detail that reads as iOS rather than "div with
 * border-radius", and it costs one path.
 */
const SQUIRCLE =
  'M50 0C88 0 100 12 100 50C100 88 88 100 50 100C12 100 0 88 0 50C0 12 12 0 50 0Z'

export function TaskIconTile({
  icon,
  color,
  size = 36,
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
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <path d={SQUIRCLE} fill={tint} fillOpacity={0.14} />
      </svg>
      {/* createElement rather than <Icon />: the lint rule cannot tell a
          lookup into a static map from a component defined during render,
          and the icons are stable module references either way. */}
      {createElement(taskIcon(icon), {
        size: size * 0.5,
        strokeWidth: 1.75,
        style: { color: tint },
        className: 'relative',
        'aria-hidden': true,
      })}
    </span>
  )
}
