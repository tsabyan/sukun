'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PHONE_MAX_WIDTH } from '@/components/shell/AppShell'
import { devPhoneHeight } from '@/lib/dev/state'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { ease, dur } from '@/lib/motion/tokens'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  /** fractions of viewport height, ascending — docs/05-screens.md C5 */
  snapPoints?: [number, number] | [number]
  children: React.ReactNode
  /** rendered in the header's right slot */
  action?: React.ReactNode
  className?: string
}

const DISMISS_FRACTION = 0.4
const VELOCITY_THRESHOLD = 500

export function Sheet({
  open,
  onClose,
  title,
  snapPoints = [0.6, 0.95],
  children,
  action,
  className,
}: SheetProps) {
  const [snapIndex, setSnapIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  // Reset to the smallest snap each time it opens. Adjusting state during
  // render is the sanctioned way to derive from a prop change — an effect here
  // would render the sheet at the wrong height for one frame.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSnapIndex(0)
  }

  // Esc to dismiss.
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

  // Lock the page behind the sheet.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Move focus in on open, hand it back on close.
  useEffect(() => {
    if (open) {
      restoreFocusTo.current = document.activeElement as HTMLElement | null
      // wait for the presence animation to mount the panel
      const id = requestAnimationFrame(() => panelRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
    restoreFocusTo.current?.focus()
  }, [open])

  const phoneHeight = devPhoneHeight()
  const height = phoneHeight
    ? `${Math.round(snapPoints[snapIndex] * phoneHeight)}px`
    : `${snapPoints[snapIndex] * 100}dvh`

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const panelHeight = panelRef.current?.offsetHeight ?? 0
      const draggedDown = info.offset.y
      const flick = info.velocity.y

      // dismiss
      if (draggedDown > panelHeight * DISMISS_FRACTION || flick > VELOCITY_THRESHOLD) {
        onClose()
        return
      }
      // expand to the next snap point
      if (
        snapPoints.length > 1 &&
        snapIndex === 0 &&
        (draggedDown < -60 || flick < -VELOCITY_THRESHOLD)
      ) {
        setSnapIndex(1)
        return
      }
      // collapse back down
      if (snapIndex === 1 && (draggedDown > 60 || flick > VELOCITY_THRESHOLD / 2)) {
        setSnapIndex(0)
      }
    },
    [onClose, snapIndex, snapPoints.length],
  )

  // No document during SSR. On the client the portal is created immediately;
  // its contents are empty while closed, so hydration stays in step.
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-center">
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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0, height }}
            exit={{ y: '100%' }}
            transition={{ duration: dur.slow, ease: ease.ios }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'absolute bottom-0 flex w-full flex-col rounded-t-xl bg-surface',
              'shadow-lg focus:outline-none',
              className,
            )}
            style={{
              maxWidth: PHONE_MAX_WIDTH,
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* grabber */}
            <div className="flex shrink-0 cursor-grab justify-center py-2.5 active:cursor-grabbing">
              <span className="h-[5px] w-10 rounded-full bg-track" />
            </div>

            {(title || action) && (
              <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3.5">
                <h2 className="text-title-m text-ink">{title}</h2>
                {action}
              </header>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
