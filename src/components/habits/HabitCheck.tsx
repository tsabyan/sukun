'use client'

import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { spring } from '@/lib/motion/tokens'
import { cn } from '@/lib/utils/cn'

/** The round mark-done toggle shared by the Today rows and habit cards. */
export function HabitCheck({
  done,
  onToggle,
  size = 'md',
}: {
  done: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
}) {
  const px = size === 'sm' ? 36 : 44
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
      transition={spring.snappy}
      aria-pressed={done}
      aria-label={done ? 'Mark not done' : 'Mark done'}
      style={{ width: px, height: px }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
        done
          ? 'border-transparent bg-accent text-on-accent'
          : 'border-hairline-strong text-ink-3 hover:border-accent hover:text-accent',
      )}
    >
      {done && <Check size={size === 'sm' ? 18 : 22} strokeWidth={3} />}
    </motion.button>
  )
}
