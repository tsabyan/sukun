import { createBrowserClient } from '@supabase/ssr'

/**
 * The browser client — docs/08-deployment.md §2.
 *
 * `db.schema` is not optional here. Every table this app owns lives in the
 * `sukun` schema because the project's database is shared with other
 * applications; without this the client queries `public` and every request
 * 404s with nothing useful in the message.
 *
 * The anon key is public by design. It ships in the client bundle and RLS is
 * what protects the data. The service_role key never appears in this repo.
 */

export const DB_SCHEMA = 'sukun'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Sync is optional. Without credentials the app is simply local-only. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

// Inferred rather than annotated: passing `db.schema` narrows the client's
// schema generic away from the default "public", and writing that type out by
// hand means restating it every time the schema name changes.
function makeClient() {
  return createBrowserClient(url!, anonKey!, {
    db: { schema: DB_SCHEMA },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export type AjegClient = ReturnType<typeof makeClient>

let client: AjegClient | null = null

export function getSupabase(): AjegClient | null {
  if (!isSupabaseConfigured()) return null
  client ??= makeClient()
  return client
}

/** Magic links need an absolute URL; the env var is only needed in production. */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin)
  )
}
