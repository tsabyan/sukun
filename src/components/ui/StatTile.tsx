'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * A number and what it means — docs/04-design-system.md §5. Two per row.
 * The arrow only appears when the tile actually goes somewhere.
 */
export function StatTile({
  value,
  label,
  href,
  className,
}: {
  value: string
  label: string
  href?: string
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="numerals text-display-s">{value}</span>
        {href ? <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden /> : null}
      </div>
      <span className="text-body-sm text-ink">{label}</span>
    </>
  )

  const shell = cn(
    'flex min-h-[128px] min-w-0 flex-1 flex-col justify-between gap-2',
    'rounded-lg bg-surface p-4 text-ink shadow-md',
    className,
  )

  if (!href) return <div className={shell}>{body}</div>

  return (
    <Link href={href} className={cn(shell, 'transition-shadow duration-200 hover:shadow-lg')}>
      {body}
    </Link>
  )
}

/** Two tiles side by side. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2.5">{children}</div>
}
