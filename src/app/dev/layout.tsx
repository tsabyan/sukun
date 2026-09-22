import { notFound } from 'next/navigation'

/**
 * The dev routes do not exist in production.
 *
 * `/dev/seed` calls `deleteAllData()` and then writes ninety days of invented
 * sessions. On a deployed build that is a public URL which destroys a real
 * person's data and replaces their statistics with fiction — one tap, no
 * confirmation, nothing to undo. `/dev/task` and `/dev/timer` are harmless by
 * comparison and gated with them because the reason they exist is the same.
 *
 * A server component, so the check runs before any of it is sent: the pages
 * below are client components and `NODE_ENV` inside one is a build-time
 * substitution that still ships the markup.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return children
}
