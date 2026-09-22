import { Mascot } from '@/components/brand/Mascot'

/**
 * Stand-in for screens that arrive in a later roadmap phase. Deleted as each
 * screen lands — nothing here survives past Phase 7.
 */
export function PhasePlaceholder({
  screen,
  phase,
  doc,
}: {
  screen: string
  phase: number
  doc: string
}) {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 text-center">
      <Mascot size={72} mood="thinking" />
      <h1 className="text-title-l font-display text-ink">{screen}</h1>
      <p className="max-w-xs text-body text-ink-2">
        Arrives in Phase {phase}. Specified in {doc}.
      </p>
    </div>
  )
}
