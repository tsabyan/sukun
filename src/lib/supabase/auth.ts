'use client'

import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured, siteUrl } from './client'
import { recordEvent } from '@/lib/db/repo'

/**
 * Auth, kept deliberately thin — docs/02-architecture.md §5.
 *
 * There is no anonymous sign-in. Until someone adds an email the app has no
 * Supabase session at all and runs entirely on IndexedDB, which is the normal
 * state rather than a degraded one: the first run asks for nothing and works
 * offline, and sync is opt-in.
 *
 * The cost of that choice is that rows created before signing in carry a
 * device-local user id rather than a real auth.uid(). `adoptUserId` rewrites
 * them once, on the first sync after sign-in. With anonymous auth that step
 * was free; without it, it is the thing that must not break.
 */

export type AccountState = 'unconfigured' | 'loading' | 'signed-out' | 'linked'

interface AuthStore {
  session: Session | null
  state: AccountState
  set: (patch: Partial<Omit<AuthStore, 'set'>>) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  state: isSupabaseConfigured() ? 'loading' : 'unconfigured',
  set: (patch) => set(patch),
}))

const classify = (session: Session | null): AccountState =>
  session ? 'linked' : 'signed-out'

/**
 * Reads any existing session. Never creates one — signing in is always a
 * deliberate act by the user.
 */
export async function ensureSession(): Promise<Session | null> {
  const supabase = getSupabase()
  if (!supabase) {
    useAuthStore.getState().set({ state: 'unconfigured' })
    return null
  }

  // Wrapped because an unreachable project throws rather than returning an
  // error: a wrong ref, a paused project or a dead network would otherwise
  // leave this pending forever and take the account UI down with it.
  try {
    const { data } = await supabase.auth.getSession()
    useAuthStore.getState().set({ session: data.session, state: classify(data.session) })
    return data.session
  } catch (error) {
    console.warn(
      '[ajeg] sync unavailable; running local-only',
      error instanceof Error ? error.message : error,
    )
    useAuthStore.getState().set({ state: 'unconfigured' })
    return null
  }
}

export function watchAuth(): () => void {
  const supabase = getSupabase()
  if (!supabase) return () => {}

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.getState().set({ session, state: classify(session) })

    // SIGNED_IN only, never INITIAL_SESSION: the latter fires on every load
    // for anyone already signed in, and this is meant to count the moment a
    // guest becomes an account — the last step of the funnel.
    if (event === 'SIGNED_IN') void recordEvent('account_linked')
  })

  return () => data.subscription.unsubscribe()
}

/**
 * Google OAuth — the primary way in. Redirects the whole page to Google and
 * returns to /auth/callback with a code, which the callback exchanges for a
 * session exactly like the magic link. Guest data adopts on the first sync
 * after that, so nothing created as a guest is lost.
 *
 * Resolves only if *starting* the redirect fails; on success the browser has
 * already navigated away.
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { error: 'Sync is not configured on this build.' }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${siteUrl()}/auth/callback?next=/settings` },
  })

  return { error: error?.message ?? null }
}

/** Magic link — the passwordless email alternative to Google. */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { error: 'Sync is not configured on this build.' }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/settings` },
  })

  return { error: error?.message ?? null }
}

/**
 * Signing out leaves every local row exactly where it is. Nothing is deleted
 * and nothing is hidden — the app simply stops syncing.
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabase()
  await supabase?.auth.signOut()
  useAuthStore.getState().set({ session: null, state: 'signed-out' })
}
