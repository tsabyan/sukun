'use client'

import { ConfirmSheet } from '@/components/ui/ConfirmSheet'

/**
 * The question asked when play is tapped on a second task — issue #6.
 *
 * Not destructive: the running session keeps every minute it has earned, and
 * they are already recorded against the task that earned them. What changes is
 * which task the *rest* of this block counts towards.
 */
export function SwitchTaskSheet({
  open,
  runningTitle,
  nextTitle,
  onConfirm,
  onClose,
}: {
  open: boolean
  runningTitle: string | null
  nextTitle: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ConfirmSheet
      open={open}
      title={runningTitle ? `"${runningTitle}" is already running` : 'A session is already running'}
      body={
        nextTitle
          ? `Switching moves the rest of this block onto "${nextTitle}". The minutes already focused stay with ${runningTitle ? `"${runningTitle}"` : 'the running task'}.`
          : 'Switching moves the rest of this block onto the new task. The minutes already focused stay where they are.'
      }
      confirmLabel="Switch task"
      cancelLabel="Keep the current one"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
