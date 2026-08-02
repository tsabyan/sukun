'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * The iOS grouped inset list — docs/05-screens.md S9.
 *
 * There is no Save button anywhere in settings. Every control writes as it is
 * touched, which is why each row can be this plain.
 */

export function SettingsGroup({
  title,
  footnote,
  children,
}: {
  title: string
  footnote?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow px-1 text-ink-3">{title}</h2>
      <div className="inset-divider overflow-hidden rounded-lg border border-hairline bg-surface">
        {children}
      </div>
      {footnote && <p className="px-1 text-body-sm text-ink-3">{footnote}</p>}
    </section>
  )
}

const ROW = 'flex min-h-[52px] w-full items-center gap-3 px-4 text-left'

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className={ROW}>
      <span className="min-w-0 flex-1">
        <span className="block text-body text-ink">{label}</span>
        {description && <span className="block text-body-sm text-ink-3">{description}</span>}
      </span>
      {children}
    </div>
  )
}

export function SettingsButtonRow({
  label,
  description,
  value,
  destructive,
  onClick,
}: {
  label: string
  description?: string
  value?: string
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={cn(ROW, 'transition-colors hover:bg-surface-raised')}>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-body', destructive ? 'text-ember' : 'text-ink')}>
          {label}
        </span>
        {description && <span className="block text-body-sm text-ink-3">{description}</span>}
      </span>
      {value && <span className="text-body tabular-nums text-ink-2">{value}</span>}
      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-3" aria-hidden />
    </button>
  )
}
