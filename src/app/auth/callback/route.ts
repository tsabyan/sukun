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

/**
 * `next` arrives in the query string and ends up in a redirect, so it is
 * attacker-controlled input. `new URL(next, origin)` resolves an absolute URL
 * against nothing — `?next=https://evil.example` wins over the base and the
 * app becomes an open redirect on a domain users are about to trust with a
 * sign-in. Only a same-site path is allowed through, and `//host` is rejected
 * too: the browser reads it as protocol-relative and leaves the site.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/settings'
  return raw
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))

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
