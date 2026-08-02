# 08 — Deployment on $0

Vercel Hobby + Supabase Free. Two traps to know about before you start.

## 1. Read this first — the two traps

### Vercel Hobby forbids commercial use

Vercel's Hobby plan is for non-commercial projects. A free app with a waitlist is fine. **The moment you charge money — a Stripe/Lemon Squeezy checkout, a paid tier, ads — you must be on Pro ($20/mo).**

This does not block the validation plan. Validate on Hobby, and treat the $20/mo as the cost of your first paying customer, not a startup cost.

### Supabase free projects pause after 7 days of inactivity

An unpaused project needs a query at least once a week. A project with no users gets no queries. It pauses, and the next visitor sees errors.

Because the app is local-first, this is a soft failure — the app still works offline-first, only sync breaks. Fix it anyway with the keep-alive in §4.

**Other free-tier limits worth knowing:** 500MB database, 5GB egress/month, 50,000 monthly active users, 2 active projects. You will not come close to any of these during validation. This app's whole dataset for one heavy user is under 2MB.

---

## 2. Supabase setup

### Everything lives in the `sukun` schema, not `public`

This project's database is shared with other applications — it already carries `stash` and `tend` schemas. `public` is not ours to take: an app that scatters tables called `tasks` and `sessions` into a shared public schema will collide with a neighbour eventually, and the collision surfaces as a baffling RLS failure rather than an obvious error.

Three consequences, and all three are silent failures if missed:

1. **PostgREST does not expose a non-public schema until you list it.** Every query returns `PGRST106 Invalid schema` until then.
2. **Supabase's default grants only cover `public`.** Usage and table privileges must be granted explicitly — including *default* privileges, or the next table added in a later migration is invisible to the API. Migration `…_grants.sql` does this.
3. **The client must set `db: { schema: 'sukun' }`.** Without it the client queries `public` and 404s.

### Apply the schema

Migrations live in `supabase/migrations/`, timestamped and idempotent. Either:

```bash
supabase login
supabase link --project-ref <your-ref>
supabase db push
```

…or paste `supabase/apply-all.sql` into the dashboard SQL editor and run it once. That file is every migration concatenated in order; regenerate it with `npm run db:bundle` after adding one.

### Dashboard settings

| Setting | Value |
|---------|-------|
| Settings → API → **Exposed schemas** | **Add `sukun`** alongside whatever is already there. Nothing works until this is set. |
| Authentication → Providers → **Anonymous sign-ins** | **Enabled** — required for the zero-friction first run |
| Authentication → Providers → Email | Enabled, **Confirm email on**, magic link only |
| Authentication → URL Configuration → Site URL | your production URL |
| Redirect URLs | `https://yourdomain.com/auth/callback`, `http://localhost:3000/auth/callback` |
| Authentication → Rate limits | Leave defaults. Anonymous sign-ins are rate-limited per IP — that's a feature. |

### Checking it from the shell

The anon key is public, so these are safe to run anywhere:

```bash
set -a; . ./.env; set +a
K="$NEXT_PUBLIC_SUPABASE_ANON_KEY"; U="$NEXT_PUBLIC_SUPABASE_URL"

# schema exposed and migrated? expects [] rather than an error
curl -s "$U/rest/v1/tasks?select=id&limit=1" \
  -H "apikey: $K" -H "Authorization: Bearer $K" -H "Accept-Profile: sukun"

# anonymous sign-ins on? expects a token, not anonymous_provider_disabled
curl -s -X POST "$U/auth/v1/signup" -H "apikey: $K" \
  -H "Content-Type: application/json" -d '{}'
```

A free project also **pauses after 7 days idle**, and a paused project's subdomain stops resolving entirely — `getent hosts <ref>.supabase.co` returning NXDOMAIN means paused or deleted, not a typo. §4 keeps it awake.

**Verify RLS before you ship.** In the SQL editor, sign in as two different users and confirm each sees only their own rows. RLS that's enabled but has a wrong policy looks identical to working RLS until it doesn't.

```sql
-- run as user A, should return 0
select count(*) from tasks where user_id != auth.uid();
```

---

## 3. Vercel setup

```bash
npm i -g vercel
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel env add CRON_SECRET production
```

Connect the GitHub repo for automatic preview deploys on every branch. Production deploys from `main`.

The anon key is public by design — it's in the client bundle and RLS is what protects the data. **Never add the `service_role` key to Vercel.** This app has no server-side privileged path, so there is no reason for that key to exist outside your password manager.

### `next.config.ts`

```ts
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

export default withSerwist({
  reactStrictMode: true,
  experimental: { optimizePackageImports: ['lucide-react', 'date-fns'] },
})
```

---

## 4. Keep-alive cron

Vercel Hobby allows cron jobs but **only runs them once per day**, at an unguaranteed hour. Once a day is plenty for a 7-day pause window.

```json
// vercel.json
{ "crons": [{ "path": "/api/cron/keepalive", "schedule": "0 6 * * *" }] }
```

```ts
// src/app/api/cron/keepalive/route.ts
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  // any query counts as activity; head+count reads no rows
  const { error } = await supabase.from('waitlist').select('id', { count: 'exact', head: true })
  return Response.json({ ok: !error, at: new Date().toISOString() })
}
```

Vercel sends the `CRON_SECRET` as a bearer token automatically when the env var is set.

**Belt and braces:** add a GitHub Action on the same schedule hitting the same endpoint. If the Vercel deployment is ever paused, the Action still keeps Supabase awake — and it costs nothing.

---

## 5. PWA specifics

```ts
// src/app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sukun — Focus Timer',
    short_name: 'Sukun',
    description: 'A calm Pomodoro timer and daily planner.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0F1216',
    theme_color: '#0F1216',
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

**iOS Safari checklist** — the platform where PWAs are most annoying and most necessary:

- `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, and an `apple-touch-icon` in `layout.tsx` metadata.
- **Notifications require the app be installed to the Home Screen.** Detect `window.navigator.standalone === false` and show the Add to Home Screen instructions from S10 card 3 instead of a permission prompt that can't succeed.
- Respect safe-area insets everywhere: `padding-bottom: env(safe-area-inset-bottom)` on the tab bar and every sheet.
- iOS suspends `AudioContext` on backgrounding. Re-`resume()` on `visibilitychange`.

### Service worker caching

- **Precache** the app shell, fonts, icons, chime audio files.
- **Network-first** for navigation, with the cached shell as the offline fallback.
- **Never cache** `/api/*` or anything under `supabase.co` — sync manages its own state, and a cached auth response is a bug that takes a day to find.

---

## 6. Custom domain

A `.com` runs $10–15/year — the only mandatory cost in this whole plan, and optional at that. `yourapp.vercel.app` is fine for validation; it costs you a little credibility in a Reddit post and nothing anywhere else.

If you buy one: add it in Vercel → Domains, update Supabase Site URL and redirect URLs, and update `NEXT_PUBLIC_SITE_URL`. Magic links break silently if you forget the second step.

---

## 7. Analytics on the free tier

You need retention numbers, and you need them without a bill.

| Tool | Free tier | Use for |
|------|-----------|---------|
| **Vercel Web Analytics** | 2,500 events/mo on Hobby | Pageviews, referrers. Zero config. |
| **PostHog Cloud** | 1M events/mo | Funnels, retention cohorts, session counts. This is the one that answers "is day-7 retention above 20%". |
| **Supabase** | — | Waitlist conversions, straight from the table |

Events worth tracking, and no others:

```
app_opened · session_started · session_completed · session_skipped
task_created · task_completed · autoplan_run
flip_mode_entered · pro_gate_hit · waitlist_submitted
account_linked · pwa_installed
```

Track *events*, never task titles or notes. A productivity app that ships user content to an analytics vendor deserves the review it gets.

---

## 8. Pre-launch checklist

```
□ RLS verified with two real users, by hand
□ Anonymous sign-in enabled and tested in a fresh incognito window
□ Magic link works from a phone, not just localhost
□ Keep-alive cron returns 200 (Vercel + GitHub Action)
□ Lighthouse mobile: Perf ≥ 90, A11y ≥ 95, PWA installable
□ Installed to an iPhone Home Screen and an Android home screen
□ Offline: airplane mode, full session, reconnect, data intact
□ Backgrounded 25-minute session drifts < 1s
□ Analytics events firing (check PostHog live view)
□ Waitlist insert works and is readable in the dashboard
□ Privacy page exists and is honest about what's stored where
□ Error boundary on every route — a white screen loses the user permanently
```
