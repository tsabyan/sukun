import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DB_SCHEMA } from './client'

/**
 * Server client, used by the auth callback (Google OAuth + magic link) and
 * nothing else.
 *
 * The browser client from @supabase/ssr keeps the session — and the PKCE
 * verifier — in cookies, which is what lets this route finish the exchange the
 * browser started. It still uses the anon key: there is no privileged
 * server-side path in this app.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: DB_SCHEMA },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware/route that owns the response writes them instead.
          }
        },
      },
    },
  )
}
