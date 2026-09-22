# 10 — Validation Plan

The point of the free tier is to find out whether anyone wants this before spending money on it. This doc says what to measure and what each result means.

## 1. The one number

**Day-7 retention.** Of the people who complete a session on day 0, how many complete a session in the 7-day window after?

| Result | Read | Do |
|--------|------|----|
| **> 25%** | Genuine product-market pull for a free timer app. | Build payments. Move to Vercel Pro. |
| **15–25%** | Real but not proven. Something works; something's missing. | Talk to the retained users, ship one more cycle. |
| **8–15%** | Normal for a free utility with no habit hook. | Fix onboarding and notifications before touching features. |
| **< 8%** | The concept isn't landing. | Stop building. Change the concept or the audience. |

Everything else — pageviews, likes, sign-ups — is noise you can produce with a good screenshot. Retention is the only metric that can't be faked by marketing.

## 2. Counting people who never sign in

The app works with no account, on purpose. That makes `auth.users` the wrong number to look at — it counts people who *signed up*, not people who *use the thing*, and most users never will.

So the app writes one row per device per local day to `device_days`:

- `device_id` — a random UUID generated on the device. Not a fingerprint, not an IP, not derived from anything. It identifies an install, not a person.
- `local_date` — the user's calendar day.
- `user_id` — null for a guest, set once that device has an account, so guests and registered users are one funnel rather than two disconnected numbers.

Insert-only: there is no UPDATE policy to abuse, and a repeat insert on the same day is a harmless duplicate-key error rather than something the client has to coordinate. It goes through the outbox, so a day spent offline still lands later.

**The dashboard queries.** Run these in the Supabase SQL editor:

```sql
-- headline: how many people, and how many of them signed up
select * from device_totals;

-- daily actives, split guest vs registered
select * from daily_active_devices limit 30;

-- new devices per day
select min(local_date) as joined_on, count(*) as new_devices
from (select device_id, min(local_date) as local_date
      from device_days group by device_id) f
group by 1 order by 1 desc;

-- opens-based retention. Useful, but it is NOT the number — it counts
-- coming back, not doing anything. The real one is in §3.
with first_day as (
  select device_id, min(local_date) as cohort from device_days group by 1
)
select f.cohort,
       count(distinct f.device_id) as joined,
       count(distinct d.device_id) filter (
         where d.local_date between f.cohort + 1 and f.cohort + 7
       ) as returned_within_7d
from first_day f
left join device_days d using (device_id)
group by f.cohort order by f.cohort desc;
```

**What this does not measure.** A device is not a person: one user on a phone and a laptop counts twice until they sign in, and clearing browser storage starts a new device. Treat the number as *installs*, and the ratio as retention. That is exactly what the day-30 decision needs.

**Why not anonymous auth.** Supabase can create a real `auth.uid()` per guest, which would count them in `auth.users` directly. It was deliberately dropped: it fills the auth table with accounts nobody asked for, it needs a session before the app can do anything, and it makes "signed out" a state that does not exist. A random device id in one insert-only table gives the same count with none of that.

## 3. Instrumentation

`device_days` answers *how many people opened the app*. It cannot answer *how many used it*, and that is the question this whole plan turns on. A guest's sessions live in IndexedDB and never leave the device, so the `sessions` table only ever describes the minority who signed in.

`device_events` closes that gap. One row per (device, local day, event, occurrence), insert-only, pushed through the same outbox as the heartbeat so it works signed out and offline. **Event names only** — no task titles, no notes, no tag names, no durations. The vocabulary is a closed union in `lib/db/types.ts` and a CHECK constraint in migration 013, so adding to it is deliberate in two places.

```
app_opened · onboarding_done · task_created · task_completed
session_started · session_completed · session_skipped
autoplan_run · habit_checked · pro_gate_hit · waitlist_submitted
account_linked · pwa_installed
```

**No analytics vendor.** PostHog would give a funnel UI for free, and it would also cost a dependency, a third-party script on an app whose measured weakness is hydration cost, and a consent obligation the moment traffic is European. The three views below answer the day-30 questions without any of that. If the numbers justify it later, adding PostHog on top is a day's work.

### The definitions

| Term | Means |
|------|-------|
| **Opened** | a `device_days` row — the app was launched |
| **Activated** | at least one `session_completed`: a focus phase run to its end. This is "actually used it". |
| **Engaged** | three or more completed sessions in the first seven days |
| **Retained** | completed a session on day 0 **and** again within days 1–7. **The number.** |

### The dashboard queries

```sql
-- funnel: opened → onboarded → task → started → completed → installed → signed in
select * from activation_funnel;

-- THE number, by cohort. cohort_complete = false means it is still filling.
select * from retention_d7;

-- how heavy the heavy users are, and whether the planner is used at all
select count(*) filter (where activated)  as activated_devices,
       count(*) filter (where engaged)    as engaged_devices,
       round(avg(sessions_completed), 1)  as avg_sessions
from device_engagement;

-- what actually arrived, by day, when a funnel number looks wrong
select * from daily_events limit 50;
```

All four views are revoked from `anon` and `authenticated` and readable only as `service_role` — i.e. from the SQL editor. They are aggregates over a table with no SELECT policy, and how many people use the product is not something to hand out with the JavaScript. Migration 009 is the story of forgetting that once.

Two things worth watching beyond the funnel: what fraction of devices ever run **Auto-plan** (`autoplan_run` — the planner is the differentiator; if nobody touches it, it isn't one), and **`pwa_installed`**, which is the cheapest read available on whether a native app is wanted at all.

**Never send task titles, notes, or tag names to any analytics service, including our own.**

## 4. Launch sequence

Free channels, in order. Each one is a separate week so you can tell which audience actually responded.

**Week 1 — soft launch.** Post in r/pomodoro, r/productivity, and r/getdisciplined. Not a launch post — a build post: "I built a Pomodoro app that works offline and doesn't cost $20/mo. Free, no account needed." Reddit punishes marketing and rewards a real story with real screenshots. Answer every comment.

**Week 2 — the maker audience.** Product Hunt (free), Hacker News Show HN, Indie Hackers, and a Twitter/X thread built around the Flip Clock screen. The angle for this crowd is the *technical* one: local-first, offline, zero-cost stack. That's the part they'll upvote.

**Week 3 — search.** A short comparison page ("Ajeg vs Forest vs Session"), a "best free Pomodoro apps" listicle submission, and an AlternativeTo entry. Slow, compounding, free.

**Ongoing.** A changelog page, updated every ship. It costs nothing and it's the single cheapest retention tool a small product has.

## 5. Qualitative signal

Numbers tell you *whether*; people tell you *why*. Both are needed.

- An in-app feedback row in Settings → About that opens a `mailto:` with the version pre-filled. Do not build a feedback form.
- After a user's **tenth** completed session, one quiet prompt: "How's this working for you?" with a single text field. Tenth, not third — asking before someone has an opinion gets you noise.
- Reply to every Reddit and Product Hunt comment personally. Ten real conversations beat a thousand pageviews at this stage.

Ten unprompted qualitative responses is the target. If you can't get ten people to say anything at all, the retention number won't matter.

## 6. Decision point — day 30

Sit down with three numbers: day-7 retention, waitlist conversion on `pro_gate_hit`, and the count of qualitative responses.

- **Retention above the bar and 5%+ waitlist conversion** → build payments (Lemon Squeezy or Polar — merchant of record, no monthly fee, handles VAT), move to Vercel Pro, email the waitlist.
- **Retention above the bar, weak waitlist** → the product works, the Pro tier doesn't. The gate is wrong or the feature list is wrong. Ask the retained users directly what they'd pay for.
- **Retention below the bar** → don't add features. The most common failure mode here is building v2 of something nobody used in v1. Either change the audience, change the concept, or stop.

Set the date now. A decision point you schedule in advance is a decision; one you make when you feel like it is a rationalization.

## 7. What not to do during validation

- **Don't build payments before the retention number exists.** It's a week of work and it's also the thing that forces you onto a paid Vercel plan.
- **Don't add features from feature requests.** Early users ask for what their last app had. Add what the retained users *do*, not what new users *say*.
- **Don't buy ads.** You cannot read a retention signal through paid traffic at this volume, and you'll spend money to learn nothing.
- **Don't rebuild the design.** You already have a design system. Changing it mid-validation means you can't tell whether the numbers moved because of the product or the paint.
