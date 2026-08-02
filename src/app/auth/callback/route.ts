import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Finishes the magic-link exchange and sends the user back into the app.
 *
 * Linking an email to an existing anonymous user preserves the same auth.uid(),
 * so every row created before signing in already belongs to the account. That
 * is the whole reason this app starts anonymous rather than inventing a local
 * user id: there is no data migration to get wrong.
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
