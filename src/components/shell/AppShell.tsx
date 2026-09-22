'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'
import { useFabStore } from '@/lib/ui/fab'
import { AddMenu } from './AddMenu'
import { FULLSCREEN_ROUTES, PRIMARY_NAV, isActive, type NavItem } from './nav'

/**
 * Ajeg is a phone app that happens to run in a browser — docs/05-screens.md §0.
 *
 * There is no desktop layout and no side rail. A wide window gets the same
 * single phone-width column, centred on the canvas, so one set of screens is
 * the only set we design, build and test. Reaching for the thumb zone is the
 * whole point of the bottom bar, and a 1440px-wide version of it would be a
 * different product.
 */
export const PHONE_MAX_WIDTH = 440

/** Tab bar height, before the safe area. Content pads by this much. */
const BAR_HEIGHT = 90

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const fullscreen = FULLSCREEN_ROUTES.some((r) => pathname.startsWith(r))

  return (
    <div className="relative z-10 flex min-h-dvh justify-center">
      <div
        className="relative flex min-h-dvh w-full flex-col"
        style={{ maxWidth: PHONE_MAX_WIDTH }}
      >
        {fullscreen ? (
          children
        ) : (
          <>
            <main
              className="w-full flex-1 px-4 pt-1.5"
              // Room for the bar, which floats over the scroll.
              style={{
                paddingBottom: `calc(${BAR_HEIGHT + 8}px + env(safe-area-inset-bottom))`,
              }}
            >
              {children}
            </main>
            <BottomBar pathname={pathname} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * A charcoal capsule with a gap in the middle, and the add button riding in
 * that gap — docs/05-screens.md §0.
 *
 * Two tabs either side of the button, never four plus a corner "+": the
 * primary action belongs under the thumb, and the middle of the bottom edge is
 * the easiest point on a phone to hit.
 */
function BottomBar({ pathname }: { pathname: string }) {
  const hidden = useFabStore((s) => s.hidden)
  const [addOpen, setAddOpen] = useState(false)
  const [left, right] = [PRIMARY_NAV.slice(0, 2), PRIMARY_NAV.slice(2)]

  return (
    <div
      className="pointer-events-none fixed bottom-0 z-30 w-full px-4 pt-[18px] pb-2.5"
      style={{
        maxWidth: PHONE_MAX_WIDTH,
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
      }}
    >
      <nav
        aria-label="Primary"
        className="pointer-events-auto relative flex h-[62px] items-center justify-between rounded-full bg-ink px-1.5 shadow-lg"
      >
        {left.map((item) => (
          <TabItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        {/* The gap the button sits in. It keeps its width on the screens that
            hide the button, so the tabs never shift between routes. */}
        <span className="relative w-14 shrink-0" aria-hidden={hidden}>
          {!hidden && (
            // The wrapper owns the position, the button owns the press. Motion
            // writes `transform` wholesale, so a translate set on the animated
            // element itself is dropped the moment `whileTap` fires.
            <span
              className="absolute left-1/2 -translate-x-1/2"
              // Raised out of the capsule: the button reads as one thing with
              // the bar, not a sticker on top of it.
              style={{ top: '50%', marginTop: -43 }}
            >
              <motion.button
                type="button"
                onClick={() => setAddOpen((open) => !open)}
                aria-label={addOpen ? 'Close the add menu' : 'Add'}
                whileTap={{ scale: 0.94 }}
                transition={spring.snappy}
                className={cn(
                  'inline-flex size-14 items-center justify-center',
                  'rounded-full bg-green text-on-accent',
                  // A 6px charcoal ring, so the half that rides above the
                  // capsule still reads as cut out of the bar rather than
                  // stuck on top of it.
                  'shadow-[0_0_0_6px_var(--text-primary),var(--shadow-fab)]',
                )}
              >
                {addOpen ? (
                  <X size={26} strokeWidth={1.75} aria-hidden />
                ) : (
                  <Plus size={26} strokeWidth={1.75} aria-hidden />
                )}
              </motion.button>
            </span>
          )}
        </span>

        {right.map((item) => (
          <TabItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <AddMenu open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

function TabItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className="relative inline-flex size-[50px] shrink-0 items-center justify-center rounded-full"
    >
      {active && (
        <motion.span
          layoutId="tab-active"
          transition={spring.snappy}
          className="absolute inset-0 rounded-full bg-surface"
        />
      )}
      <Icon
        size={22}
        strokeWidth={1.75}
        aria-hidden
        className={cn(
          'relative transition-colors duration-150',
          active ? 'text-ink' : 'text-surface/70',
        )}
      />
      <span className="sr-only">{item.label}</span>
    </Link>
  )
}
