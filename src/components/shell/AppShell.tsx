'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { spring } from '@/lib/motion/tokens'
import { Logomark } from '@/components/brand/Logomark'
import {
  FULLSCREEN_ROUTES,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isActive,
  type NavItem,
} from './nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const fullscreen = FULLSCREEN_ROUTES.some((r) => pathname.startsWith(r))

  if (fullscreen) return <>{children}</>

  return (
    <div className="relative z-10 flex min-h-dvh">
      <SideRail pathname={pathname} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main
          className="mx-auto w-full max-w-[720px] flex-1 px-5 pt-6 sm:px-8 lg:px-10"
          style={{
            paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </main>
      </div>

      <TabBar pathname={pathname} />
    </div>
  )
}

/* ------------------------------------------------------------------ mobile */

function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary"
      className="material fixed inset-x-0 bottom-0 z-30 border-t border-hairline lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex h-14 max-w-[520px] items-stretch">
        {PRIMARY_NAV.map((item) => (
          <TabBarItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </ul>
    </nav>
  )
}

function TabBarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <li className="flex-1">
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-full flex-col items-center justify-center gap-1',
          'transition-colors duration-150',
          active ? 'text-accent' : 'text-ink-2 hover:text-ink',
        )}
      >
        <Icon size={24} strokeWidth={1.75} aria-hidden />
        <span className="text-[11px] font-medium leading-none">{item.label}</span>
      </Link>
    </li>
  )
}

/* ----------------------------------------------------------------- desktop */

function SideRail({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-hairline px-4 py-6 lg:flex"
    >
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2.5 px-3 text-ink"
        aria-label="Sukun — home"
      >
        <Logomark size={22} className="text-accent" />
        <span
          className="font-display lowercase"
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            fontVariationSettings: '"wdth" 112',
          }}
        >
          sukun
        </span>
      </Link>

      <ul className="flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => (
          <RailItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </ul>

      <ul className="mt-auto flex flex-col gap-1 border-t border-hairline pt-4">
        {SECONDARY_NAV.map((item) => (
          <RailItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </ul>
    </nav>
  )
}

function RailItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex h-11 items-center gap-3 rounded-md px-3 text-label',
          'transition-colors duration-150',
          active ? 'text-accent' : 'text-ink-2 hover:bg-surface hover:text-ink',
        )}
      >
        {active && (
          <motion.span
            layoutId="rail-active"
            transition={spring.snappy}
            className="accent-quiet absolute inset-0 rounded-md"
          />
        )}
        <Icon size={20} strokeWidth={1.75} className="relative z-10" aria-hidden />
        <span className="relative z-10">{item.label}</span>
      </Link>
    </li>
  )
}
