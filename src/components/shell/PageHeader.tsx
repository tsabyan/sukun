import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The one page header — docs/05-screens.md.
 *
 * Every titled screen renders its title the same way: a display-face h1 on the
 * left, an optional leading control (a back or close button) beside it, and an
 * optional cluster of page actions on the right. Timer and Plan opt out on
 * purpose — one carries the brand wordmark, the other a date navigator.
 */
export function PageHeader({
  title,
  leading,
  actions,
  className,
}: {
  title: string
  /** back/close button or a leading icon, shown before the title */
  leading?: ReactNode
  /** right-hand action cluster — page-specific buttons and links */
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <h1 className="truncate text-title-l font-display text-ink">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </header>
  )
}
