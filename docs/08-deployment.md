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

### Ajeg has its own project, and everything lives in `public`

Until 2026-09-22 this app was a tenant in a shared database, in a schema called `sukun`, because `public` was not ours to take. A dedicated project removes that constraint and three silent failure modes with it: the Exposed-schemas setting, the explicit grant block, and `db: { schema }` on every client.

What replaces them is one rule, and it is not optional: **`public` grants `anon` and `authenticated` broadly by default, so a table created without RLS is world-readable the moment it exists.** In the old schema a missing grant made a new table invisible, which failed loudly. Here a missing `enable row level security` makes it public, which fails silently. Every migration that creates a table enables RLS in the same file — CLAUDE.md rule 9.

Two things did *not* move: the Dexie database name and the `sukun.*` `localStorage` keys. They are the identity of data already on people's devices (rule 12).

**If you are coming from the old project:** create the new one, run the migrations below, put its URL and anon key in the env vars, and treat the old project's rows as gone. There is no migration path written for them and none is needed — nothing was launched.

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
| Settings → API → **Exposed schemas** | Leave as `public`. Nothing else is needed now that the app has its own project. |
| Authentication → Providers → **Anonymous sign-ins** | **Disabled.** The app never uses it — signed out means no session at all, and the client runs on IndexedDB. Leaving it on is an open door with nothing behind it. |
| Authentication → Providers → **Google** | **Enabled.** The primary sign-in. Needs a Client ID + Secret from Google Cloud — see below. |
| Authentication → Providers → Email | Enabled, **Confirm email on**, magic link only. The secondary "or" option under Google. |
| Authentication → URL Configuration → Site URL | your production URL |
| Redirect URLs | `https://yourdomain.com/auth/callback`, `http://localhost:3000/auth/callback` |
| Authentication → Rate limits | Leave defaults. Anonymous sign-ins are rate-limited per IP — that's a feature. |

### Google OAuth

Google is the primary way in; magic link is the fallback. Both land on the same
`/auth/callback`, which exchanges the code for a session. A guest's local rows
adopt onto the account on the first sync after sign-in (`lib/db/identity.ts`), so
nothing made as a guest is lost — there is no separate migration step to run.

The provider needs credentials from Google, wired into Supabase. Done once:

1. **Google Cloud Console** → *APIs & Services*:
   - **OAuth consent screen** — External, add app name, support email, and your
     domain under Authorized domains. Publish it (Testing mode only lets
     allow-listed emails in).
   - **Credentials → Create credentials → OAuth client ID → Web application**.
     - *Authorized JavaScript origins:* `https://yourdomain.com`, `http://localhost:3000`
     - *Authorized redirect URI* — this is Supabase's callback, **not** the app's:
       ```
       https://<your-project-ref>.supabase.co/auth/v1/callback
       ```
   - Copy the **Client ID** and **Client secret**.

2. **Supabase** → Authentication → Providers → **Google** → enable, paste the
   Client ID and secret, save.

3. **Supabase** → Authentication → URL Configuration → confirm the app callbacks
   (`https://yourdomain.com/auth/callback` and `http://localhost:3000/auth/callback`)
   are in the redirect allow-list. These are the two callbacks in play:
   Google → Supabase's `/auth/v1/callback`, then Supabase → the app's
   `/auth/callback`.

Until all three are done the button redirects and Google rejects it with
`redirect_uri_mismatch` or `access_denied`. Nothing in the repo changes — it is
pure dashboard config.

### Checking it from the shell

The anon key is public, so these are safe to run anywhere:

```bash
set -a; . ./.env; set +a
K="$NEXT_PUBLIC_SUPABASE_ANON_KEY"; U="$NEXT_PUBLIC_SUPABASE_URL"

# migrated and reachable? expects [] rather than an error
curl -s "$U/rest/v1/tasks?select=id&limit=1" \
  -H "apikey: $K" -H "Authorization: Bearer $K"

# RLS actually on? every one of these must return [] and not rows
for t in tasks sessions settings profiles habits; do
  echo -n "$t: "
  curl -s "$U/rest/v1/$t?select=*&limit=1" -H "apikey: $K" -H "Authorization: Bearer $K"
  echo
done

# metric views must NOT be readable with the anon key
curl -s "$U/rest/v1/device_totals?select=*" -H "apikey: $K" -H "Authorization: Bearer $K"
curl -s "$U/rest/v1/activation_funnel?select=*" -H "apikey: $K" -H "Authorization: Bearer $K"

# anonymous sign-ins off? expects anonymous_provider_disabled
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
vercel env add CRON_SECRET production          # any long random string
vercel env add NEXT_PUBLIC_FEEDBACK_EMAIL production
```

`NEXT_PUBLIC_FEEDBACK_EMAIL` is the address behind Settings → About → Send feedback. Leave it unset and the row is not offered — which is worse than it sounds, because a launch with no way to reach you wastes the feedback the launch exists to collect.

Connect the GitHub repo for automatic preview deploys on every branch. Production deploys from `main`.

The anon key is public by design — it's in the client bundle and RLS is what protects the data. **Never add the `service_role` key to Vercel.** This app has no server-side privileged path, so there is no reason for that key to exist outside your password manager.

### The service worker is a post-build step, not a plugin

Serwist's classic `withSerwistInit` injects a **webpack** config, and Next 16 builds with Turbopack by default. The combination is a hard build error, and silencing it with an empty `turbopack: {}` is worse — the plugin then never runs and no worker is generated, silently.

So `next.config.ts` carries no Serwist plugin at all, and the worker is built afterwards by `@serwist/cli` reading `serwist.config.mjs`:

```jsonc
// package.json
"build": "next build && serwist build serwist.config.mjs"
```

Two things that cost time if you hit them cold: the CLI takes its config as a **positional** argument (`serwist build path`, not `--config path`), and it needs **esbuild** installed separately.

Configurator mode also does not inject a registration, so `components/pwa/ServiceWorker.tsx` registers `/sw.js` after `load`.

---

## 4. Keep-alive cron

Vercel Hobby allows cron jobs but **only runs them once per day**, at an unguaranteed hour. Once a day is plenty for a 7-day pause window.

```json
// vercel.json
{ "crons": [{ "path": "/api/cron/keepalive", "schedule": "0 6 * * *" }] }
```

Both exist in the repo: `vercel.json` and `src/app/api/cron/keepalive/route.ts`. The route refuses to run at all when `CRON_SECRET` is unset — an open endpoint that queries the database on request is not a thing to leave lying around, and an unset env var should fail in the one place that can see it.

Vercel sends the `CRON_SECRET` as a bearer token automatically when the env var is set. Verify after the first deploy:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/keepalive
# {"ok":true,"error":null,"at":"..."}
```

**Belt and braces:** `.github/workflows/keepalive.yml` hits the same endpoint on the same schedule. If the Vercel deployment is ever paused, deleted or mid-rollback, the Action still keeps Supabase awake — and it costs nothing. It needs two repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `KEEPALIVE_URL` | `https://yourdomain.com/api/cron/keepalive` |
| `CRON_SECRET` | the same string as the Vercel env var |

Run it once by hand from the Actions tab after the first deploy; a red run is the earliest warning you will get that the endpoint is wrong.

---

## 5. PWA specifics

```ts
// src/app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ajeg — Focus Timer',
    short_name: 'Ajeg',
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

There is no analytics vendor. Usage is measured by two insert-only tables in our own database — `device_days` for opens and `device_events` for what was actually done — read through four views in the SQL editor. The reasoning, the event vocabulary and the queries are in [10 §3](10-validation.md#3-instrumentation).

| Tool | Free tier | Use for |
|------|-----------|---------|
| **Our own tables** | free | Activation funnel, day-7 retention, engagement, install rate |
| **Vercel Web Analytics** | 2,500 events/mo on Hobby | Pageviews and referrers, if you want to know which launch post worked |

Track *events*, never task titles or notes. A productivity app that ships user content to an analytics vendor deserves the review it gets — and that rule does not soften because the vendor is us.

## 8. Pre-launch checklist

```
□ RLS verified with two real users, by hand
□ Guest mode works in a fresh incognito window — no sign-in, data persists locally
□ Google sign-in completes, and guest data adopts onto the account (check a row's user_id)
□ Magic link works from a phone, not just localhost
□ Keep-alive cron returns 200 (Vercel + GitHub Action)
□ Lighthouse: A11y 100, Best Practices 100, SEO 100, PWA installable
□ Lighthouse Performance — see the note below before treating this as a gate
□ Installed to an iPhone Home Screen and an Android home screen
□ Offline: airplane mode, full session, reconnect, data intact
□ Backgrounded 25-minute session drifts < 1s
□ Events firing — `select * from daily_events;` shows today's rows
□ Metric views NOT readable with the anon key (the curl in §2)
□ Waitlist insert works and is readable in the dashboard
□ Privacy page exists and is honest about what's stored where — /privacy
□ Feedback row opens a mail client with the version in the subject
□ /dev/seed and /kitchen-sink return 404 on the deployed build
□ Security headers present — `curl -sI https://yourdomain.com | grep -i 'content-security\|frame\|referrer'`
□ Error boundary on every route — a white screen loses the user permanently
```

### Lighthouse, honestly

Measured against a production build on the reference machine:

| | Perf | A11y | Best practices | SEO |
|---|---|---|---|---|
| **Desktop** | **95** | 100 | 100 | 100 |
| **Mobile** | **68–76** | 100 | 100 | 100 |

Mobile Performance was 54–57 before the fix below. **It still does not reach the 90 the roadmap asked for**, and the remaining gap is structural rather than an oversight.

**What was actually wrong.** The LCP element on a first visit is the onboarding overlay, and it could not paint until hydration finished *and* an IndexedDB read resolved — 5.7 seconds of pure render delay. The fix is the same trick already used for theming: the blocking script in `<head>` reads a `localStorage` flag and sets `data-onboarding="pending"` on `<html>`, the overlay ships in the server HTML, and CSS reveals it. `localStorage` can be stale, so the component still checks IndexedDB after mount and dismisses itself if there is history — an optimistic show that self-corrects in a frame beats a correct one that costs five seconds. **LCP 6.1s → 2.6s.**

*One trap in that:* the overlay must not carry Tailwind's `flex` class. Tailwind's utilities layer beats the components layer, so `display: flex` overrides the `display: none` that hides it, and the overlay sits invisibly on top of the app swallowing every click. The E2E suite caught it; nothing else would have.

**What is left.** TBT of roughly 0.8–2s depending on machine load, all of it script evaluation under Lighthouse's 4× CPU throttle. The payload is ordinary for a client app — react-dom 227KB, Motion 157KB, Dexie 96KB raw — and deferring the Supabase client cut 275KB from first paint while moving the score about two points. **Size is not the constraint; hydration cost is.**

Going further means one of: dropping Motion for CSS animations (contradicts doc 02 §1), server-rendering real content (contradicts local-first — there is no server-side data), or shipping less of the app on first load. All are real options; none are free. Note also that Lighthouse always tests a cold profile, so it always measures the first-run path including onboarding — a returning user never pays that. Re-measure with `--form-factor=mobile` three times before believing any change; run-to-run variance on a loaded machine is ±10 points.
