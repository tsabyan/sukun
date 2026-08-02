'use client'

import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured, siteUrl } from './client'

/**
 * Auth, kept deliberately thin — docs/02-architecture.md §5.
 *
 * First run signs in anonymously, so the app has a real auth.uid() from the
 * first second without asking for anything. Adding an email later *links* to
 * that same user, which is why signing in never migrates data: the rows
 * already belong to the right uid.
 */

export type AccountState = 'unconfigured' | 'loading' | 'anonymous' | 'linked'

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

function classify(session: Session | null): AccountState {
  if (!session) return 'loading'
  return session.user.email ? 'linked' : 'anonymous'
}

/**
 * Signs in anonymously if there is no session yet. Failure is not an error
 * worth surfacing — the app is local-first and simply stays local.
 */
export async function ensureSession(): Promise<Session | null> {
  const supabase = getSupabase()
  if (!supabase) {
    useAuthStore.getState().set({ state: 'unconfigured' })
    return null
  }

  // Wrapped because an unreachable project throws rather than returning an
  // error: a wrong ref, a deleted project or a dead network would otherwise
  // leave this pending forever and take the account UI down with it. Sync is
  // optional, so every failure here degrades to local-only.
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      useAuthStore.getState().set({ session: data.session, state: classify(data.session) })
      return data.session
    }

    const { data: created, error } = await supabase.auth.signInAnonymously()
    if (error) throw error

    useAuthStore.getState().set({ session: created.session, state: classify(created.session) })
    return created.session
  } catch (error) {
    console.warn(
      '[sukun] sync unavailable; running local-only',
      error instanceof Error ? error.message : error,
    )
    useAuthStore.getState().set({ state: 'unconfigured' })
    return null
  }
}

export function watchAuth(): () => void {
  const supabase = getSupabase()
  if (!supabase) return () => {}

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().set({ session, state: classify(session) })
  })

  return () => data.subscription.unsubscribe()
}

/** Links an email to the current (possibly anonymous) user. */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { error: 'Sync is not configured on this build.' }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/settings` },
  })

  return { error: error?.message ?? null }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase()
  await supabase?.auth.signOut()
  // Straight back to a fresh anonymous identity, so the app keeps working
  // rather than dropping into a signed-out dead end.
  await ensureSession()
}
