'use client'

import type { LucideIcon } from 'lucide-react'
import { IconTile } from './IconTile'
import { cn } from '@/lib/utils/cn'

/**
 * Every empty state names the one thing to do next — docs/05-screens.md §0.
 * Never a dead end, never an apology.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  body: string
  /** a chip or a button — the single next step */
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2.5 px-3 pb-3 pt-4 text-center',
        className,
      )}
    >
      <IconTile icon={icon} tone="green" size={48} />
      <p className="text-title-s text-ink">{title}</p>
      <p className="max-w-[46ch] text-body-sm text-ink-2">{body}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
