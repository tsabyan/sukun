'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type IconTileTone = 'ink' | 'green' | 'field' | 'ember'

const TONES: Record<IconTileTone, { box: string; icon: string }> = {
  /** charcoal box, lime glyph — the brand pairing */
  ink: { box: 'bg-ink', icon: 'text-lime' },
  green: { box: 'bg-green-soft', icon: 'text-green-deep' },
  field: { box: 'bg-field', icon: 'text-ink' },
  ember: { box: 'bg-ember-soft', icon: 'text-ember' },
}

/**
 * The rounded-square icon container that opens a row, a card header, or an
 * empty state — docs/04-design-system.md §5.
 */
export function IconTile({
  icon: Icon,
  tone = 'field',
  size = 40,
  className,
}: {
  icon: LucideIcon
  tone?: IconTileTone
  size?: number
  className?: string
}) {
  const t = TONES[tone]
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.35) }}
      className={cn('inline-flex shrink-0 items-center justify-center', t.box, className)}
    >
      <Icon
        size={Math.round(size * 0.45)}
        strokeWidth={1.75}
        className={t.icon}
      />
    </span>
  )
}
