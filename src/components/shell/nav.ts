import {
  BarChart3,
  CalendarDays,
  ListTodo,
  Settings,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/** Primary destinations — bottom tab bar on mobile, top of the rail on desktop. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Timer', icon: Timer },
  { href: '/plan', label: 'Plan', icon: CalendarDays },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/reports', label: 'Report', icon: BarChart3 },
]

/** Desktop-only, pinned to the bottom of the rail. */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/records', label: 'Personal bests', icon: Trophy },
  { href: '/settings', label: 'Settings', icon: Settings },
]

/** Routes that own the whole viewport. */
export const FULLSCREEN_ROUTES = ['/focus']

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}
