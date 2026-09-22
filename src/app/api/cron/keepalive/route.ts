import { createClient } from '@supabase/supabase-js'

/**
 * Keeps the Supabase project awake — docs/08-deployment.md §4.
 *
 * A free project pauses after seven days without a query, and a paused project
 * stops resolving its subdomain entirely. Because the app is local-first the
 * failure is quiet: every user keeps working offline, sync simply stops, and
 * the first sign of it is a metrics table that flatlined a week ago.
 *
 * A project with no users generates no queries, which is exactly the situation
 * during validation. One query a day is enough, and Vercel Hobby runs crons
 * once a day at an hour of its choosing — which is also enough.
 */

// Nothing here may be prerendered or cached; the point is the round trip.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  // Without a secret this is an open endpoint that hits the database on
  // request. Refuse rather than run: an unset env var should fail loudly in
  // the one place that can see it.
  if (!secret) {
    return Response.json({ ok: false, error: 'CRON_SECRET is not set' }, { status: 500 })
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return Response.json({ ok: false, error: 'Supabase is not configured' }, { status: 500 })
  }

  // The anon key, like everywhere else in this app. There is no server-side
  // privileged path and the service_role key does not exist in this repo.
  const supabase = createClient(url, anonKey)

  // head + count reads no rows, and RLS gives anon no SELECT policy on this
  // table anyway. Any query counts as activity; this is the cheapest one.
  const { error } = await supabase.from('waitlist').select('id', { count: 'exact', head: true })

  return Response.json({ ok: !error, error: error?.message ?? null, at: new Date().toISOString() })
}
