import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The one page header — docs/05-screens.md.
 *
 * Every titled screen renders its title the same way: an h1 on the left, an
 * optional leading control (a back button) beside it, and an optional cluster
 * of secondary actions on the right — search, share, a gear. The *primary*
 * action is never here: it lives in the bottom bar, in reach of the thumb.
 * Focus opts out entirely; it carries the brand lockup instead.
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
    <header className={cn('flex min-h-[52px] items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        {leading}
        <h1 className={cn('truncate text-ink', leading ? 'text-title-s' : 'text-title-l')}>
          {title}
        </h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
