'use client'

import { create } from 'zustand'
import { AnimatePresence, motion } from 'motion/react'
import { ease, dur } from '@/lib/motion/tokens'
import { newId } from '@/lib/utils/ids'

/**
 * Quiet, transient, and never blocking.
 *
 * A toast is the right shape for "this happened, and you can undo it" — an
 * undo that lives behind a confirmation dialog is just a slower confirmation
 * dialog. Nothing here interrupts; the timer keeps running underneath.
 */

export interface Toast {
  id: string
  message: string
  action?: { label: string; onPress: () => void }
  durationMs: number
}

interface ToastState {
  toasts: Toast[]
  show: (message: string, options?: { action?: Toast['action']; durationMs?: number }) => string
  dismiss: (id: string) => void
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show(message, options = {}) {
    const id = newId()
    const durationMs = options.durationMs ?? 4000

    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, message, action: options.action, durationMs }],
    }))

    timers.set(
      id,
      setTimeout(() => get().dismiss(id), durationMs),
    )
    return id
  },

  dismiss(id) {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))

/** Imperative helper, so non-component code can raise one. */
export const toast = (message: string, options?: Parameters<ToastState['show']>[1]) =>
  useToastStore.getState().show(message, options)

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4"
      style={{ paddingBottom: 'calc(76px + env(safe-area-inset-bottom))' }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: dur.base, ease: ease.ios }}
            className="material pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-md border border-hairline px-4 py-3 shadow-lg"
          >
            <span className="min-w-0 flex-1 text-body-sm text-ink">{item.message}</span>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action?.onPress()
                  dismiss(item.id)
                }}
                className="shrink-0 text-label text-accent"
              >
                {item.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
