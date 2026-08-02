'use client'

import dynamic from 'next/dynamic'

/**
 * Everything the first paint does not need.
 *
 * SyncProvider lives in the root layout, so a static import put the whole
 * Supabase client into the bundle for every route — including the timer that
 * most visits open and never leave, and that may never sync at all. Loading it
 * after hydration keeps it off the critical path without changing when it runs.
 *
 * Onboarding is deliberately NOT here. It is a full-screen overlay, which
 * makes it the largest contentful paint on a first visit; deferring it moved
 * LCP a further half-second out. Its heavy dependency, the task form, is
 * lazy-loaded from inside it instead.
 *
 * ssr:false is why this file exists: it is not allowed in a Server Component,
 * and the root layout is one.
 */

const SyncProvider = dynamic(
  () => import('@/components/sync/SyncProvider').then((m) => m.SyncProvider),
  { ssr: false },
)

const ServiceWorker = dynamic(
  () => import('@/components/pwa/ServiceWorker').then((m) => m.ServiceWorker),
  { ssr: false },
)

export function DeferredProviders() {
  return (
    <>
      <SyncProvider />
      <ServiceWorker />
    </>
  )
}
