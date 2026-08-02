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

## 2. Instrumentation

Wire these events in Phase 9 (list in [08](08-deployment.md) §7). Three PostHog funnels:

1. **Activation** — `app_opened` → `task_created` → `session_started` → `session_completed`. Where the drop happens tells you which screen is broken.
2. **Habit** — `session_completed` on day 0 → `session_completed` on days 1–7. This is the retention number.
3. **Willingness to pay** — `pro_gate_hit` → `waitlist_submitted`. Conversion here is your price signal.

Two things worth watching beyond the funnels: what fraction of users ever run **Auto-plan** (the planner is the differentiator — if nobody touches it, it isn't one), and what fraction enter **Flip mode** (it's the screenshot feature; low usage means it isn't worth the maintenance).

**Never send task titles, notes, or tag names to any analytics service.**

## 3. Launch sequence

Free channels, in order. Each one is a separate week so you can tell which audience actually responded.

**Week 1 — soft launch.** Post in r/pomodoro, r/productivity, and r/getdisciplined. Not a launch post — a build post: "I built a Pomodoro app that works offline and doesn't cost $20/mo. Free, no account needed." Reddit punishes marketing and rewards a real story with real screenshots. Answer every comment.

**Week 2 — the maker audience.** Product Hunt (free), Hacker News Show HN, Indie Hackers, and a Twitter/X thread built around the Flip Clock screen. The angle for this crowd is the *technical* one: local-first, offline, zero-cost stack. That's the part they'll upvote.

**Week 3 — search.** A short comparison page ("Sukun vs Forest vs Session"), a "best free Pomodoro apps" listicle submission, and an AlternativeTo entry. Slow, compounding, free.

**Ongoing.** A changelog page, updated every ship. It costs nothing and it's the single cheapest retention tool a small product has.

## 4. Qualitative signal

Numbers tell you *whether*; people tell you *why*. Both are needed.

- An in-app feedback row in Settings → About that opens a `mailto:` with the version pre-filled. Do not build a feedback form.
- After a user's **tenth** completed session, one quiet prompt: "How's this working for you?" with a single text field. Tenth, not third — asking before someone has an opinion gets you noise.
- Reply to every Reddit and Product Hunt comment personally. Ten real conversations beat a thousand pageviews at this stage.

Ten unprompted qualitative responses is the target. If you can't get ten people to say anything at all, the retention number won't matter.

## 5. Decision point — day 30

Sit down with three numbers: day-7 retention, waitlist conversion on `pro_gate_hit`, and the count of qualitative responses.

- **Retention above the bar and 5%+ waitlist conversion** → build payments (Lemon Squeezy or Polar — merchant of record, no monthly fee, handles VAT), move to Vercel Pro, email the waitlist.
- **Retention above the bar, weak waitlist** → the product works, the Pro tier doesn't. The gate is wrong or the feature list is wrong. Ask the retained users directly what they'd pay for.
- **Retention below the bar** → don't add features. The most common failure mode here is building v2 of something nobody used in v1. Either change the audience, change the concept, or stop.

Set the date now. A decision point you schedule in advance is a decision; one you make when you feel like it is a rationalization.

## 6. What not to do during validation

- **Don't build payments before the retention number exists.** It's a week of work and it's also the thing that forces you onto a paid Vercel plan.
- **Don't add features from feature requests.** Early users ask for what their last app had. Add what the retained users *do*, not what new users *say*.
- **Don't buy ads.** You cannot read a retention signal through paid traffic at this volume, and you'll spend money to learn nothing.
- **Don't rebuild the design.** You already have a design system. Changing it mid-validation means you can't tell whether the numbers moved because of the product or the paint.
