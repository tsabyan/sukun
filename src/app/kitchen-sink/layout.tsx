import { notFound } from 'next/navigation'

/**
 * The component gallery is a development tool — docs/07-roadmap.md Phase 0.
 *
 * It is not harmful in production, only wrong: a page of every button in every
 * state, with no navigation back, indexed by anyone who finds it. Gated for the
 * same reason as `/dev`.
 */
export default function KitchenSinkLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return children
}
