'use client'

import { Button } from './Button'
import { Sheet } from './Sheet'

interface ConfirmSheetProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * A decision, not a warning. The title says what will happen; the body says
 * what it costs. No "Are you sure?" — the button label already answers that.
 */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Keep going',
  destructive,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} snapPoints={[0.9]} title={title}>
      <p className="text-body text-ink-2">{body}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          fullWidth
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" fullWidth onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  )
}
