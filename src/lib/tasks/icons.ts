import {
  Activity,
  BookOpen,
  Brain,
  Briefcase,
  Bug,
  Calendar,
  Camera,
  CircleDashed,
  Code,
  Coffee,
  Compass,
  CreditCard,
  Dumbbell,
  Edit,
  FileText,
  Flag,
  GitPullRequest,
  Globe,
  GraduationCap,
  HardDrive,
  Heart,
  Home,
  Lightbulb,
  Mail,
  Music,
  Palette,
  Phone,
  ShoppingCart,
  Sparkles,
  Target,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { TaskColor } from '@/lib/db/types'

/**
 * An explicit map, not a dynamic lookup into the whole of lucide-react.
 * `import * as Icons` would pull every icon in the library into the bundle;
 * this ships the thirty-two a user can actually choose.
 */
export const TASK_ICONS: Record<string, LucideIcon> = {
  'circle-dashed': CircleDashed,
  code: Code,
  bug: Bug,
  'git-pull-request': GitPullRequest,
  'file-text': FileText,
  edit: Edit,
  'book-open': BookOpen,
  brain: Brain,
  'graduation-cap': GraduationCap,
  lightbulb: Lightbulb,
  target: Target,
  flag: Flag,
  mail: Mail,
  phone: Phone,
  users: Users,
  calendar: Calendar,
  briefcase: Briefcase,
  home: Home,
  activity: Activity,
  dumbbell: Dumbbell,
  heart: Heart,
  coffee: Coffee,
  music: Music,
  camera: Camera,
  palette: Palette,
  globe: Globe,
  compass: Compass,
  wrench: Wrench,
  'shopping-cart': ShoppingCart,
  'credit-card': CreditCard,
  'hard-drive': HardDrive,
  sparkles: Sparkles,
}

export const ICON_NAMES = Object.keys(TASK_ICONS)

export function taskIcon(name: string): LucideIcon {
  return TASK_ICONS[name] ?? CircleDashed
}

export const TASK_COLOR_VAR: Record<TaskColor, string> = {
  sage: 'var(--task-sage)',
  slate: 'var(--task-slate)',
  iris: 'var(--task-iris)',
  apricot: 'var(--task-apricot)',
  clay: 'var(--task-clay)',
  moss: 'var(--task-moss)',
  fog: 'var(--task-fog)',
  plum: 'var(--task-plum)',
}
