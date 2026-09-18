import { BarChart3, ListTodo, Sprout, Timer, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/**
 * The four primary destinations, in the bottom tab capsule.
 *
 * Four, deliberately: Plan folded into Focus as the "Today's plan" card and
 * its sheet, Records folded into Insights, and the flip clock dropped. Settings
 * is a gear in the screen header, not a destination. docs/05-screens.md §0.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Focus', icon: Timer },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/habits', label: 'Habits', icon: Sprout },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
]

/** Routes that own the whole viewport. */
export const FULLSCREEN_ROUTES = ['/focus']

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}
