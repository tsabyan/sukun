import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Finishes the auth code exchange — for both Google OAuth and the email magic
 * link — and sends the user back into the app.
 *
 * The session this creates has a real auth.uid(). Rows made as a guest carry a
 * device-local id instead, so the first sync afterwards calls adoptUserId to
 * rewrite them onto the account (see lib/db/identity.ts). That is the guest →
 * registered migration; the callback itself only establishes the session.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/settings'

  if (!code) {
    return NextResponse.redirect(new URL('/settings?auth=missing-code', url.origin))
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/settings?auth=failed', url.origin))
  }

  return NextResponse.redirect(new URL(`${next}?auth=linked`, url.origin))
}
