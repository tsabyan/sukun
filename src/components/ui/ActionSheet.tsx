'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { PHONE_MAX_WIDTH } from '@/components/shell/AppShell'
import { spring } from '@/lib/motion/tokens'
import { dur } from '@/lib/motion/tokens'
import { cn } from '@/lib/utils/cn'

export interface ActionSheetOption {
  icon: LucideIcon
  title: string
  sub: string
  /** the icon tile behind the glyph — three steps of the brand green */
  tone?: 'green' | 'green-mid' | 'surface'
  onSelect: () => void
}

const TONES = {
  green: 'bg-green',
  'green-mid': 'bg-green-mid',
  surface: 'bg-surface',
} as const

/**
 * B10 — the charcoal menu that opens from the bottom-bar button.
 *
 * Not a Sheet: it is a short panel that rises out of the button that spawned
 * it and sits directly above the bar, so the thumb never travels. Used where
 * one screen's "+" has more than one meaning.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  options,
}: {
  open: boolean
  onClose: () => void
  title: string
  options: ActionSheetOption[]
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-center">
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.base }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/45"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={spring.snappy}
            className="absolute w-full px-4"
            style={{
              maxWidth: PHONE_MAX_WIDTH,
              bottom: 'calc(98px + env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex flex-col gap-4 rounded-xl bg-ink p-4 pt-6 shadow-lg">
              <h2 className="px-2 text-title-m text-surface">{title}</h2>

              <ul className="flex flex-col gap-0.5">
                {options.map((option) => (
                  <li key={option.title}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        option.onSelect()
                      }}
                      className="flex w-full items-center gap-3.5 rounded-md px-2 py-2.5 text-left transition-colors duration-150 hover:bg-surface/10"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
                          TONES[option.tone ?? 'green'],
                        )}
                      >
                        <option.icon size={20} strokeWidth={1.75} className="text-ink" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-title-s text-surface">{option.title}</span>
                        <span className="block text-body-sm text-surface/60">{option.sub}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
