# Ajeg — Calm Pomodoro Web App

A focus timer, daily planner, and task manager. Local-first PWA. Deployed free on Vercel + Supabase.

> **Ajeg** — Javanese for *steady, level, the same every time*. Not stillness: regularity.
> The logo is the mascot on the app icon; there is no second, abstract mark. See [04-design-system.md](docs/04-design-system.md) §0.1.
>
> Renamed from Sukun. Two things kept the old name on purpose: the `sukun` Postgres schema
> (shared database, not branding) and the local IndexedDB / `localStorage` names (renaming them
> would orphan data already on people's devices).

## Doc index — read in this order

| # | Doc | What it decides |
|---|-----|-----------------|
| 01 | [Product Requirements](docs/01-prd.md) | Who it's for, what ships in v1, what's cut |
| 02 | [Architecture](docs/02-architecture.md) | Stack, local-first sync model, timer accuracy, folder layout |
| 03 | [Database](docs/03-database.md) | Full Supabase SQL: tables, RLS, views, triggers |
| 04 | [Design System](docs/04-design-system.md) | Colors, type, spacing, motion, component recipes |
| 05 | [Screen Specs](docs/05-screens.md) | All 10 routes, element by element |
| 06 | [Data Contracts](docs/06-data-contracts.md) | TypeScript types + repository interfaces |
| 07 | [Build Roadmap](docs/07-roadmap.md) | 9 phases, ordered, with done-criteria |
| 08 | [Deployment](docs/08-deployment.md) | Free-tier setup, limits, gotchas |
| 09 | [Vibe Prompts](docs/09-vibe-prompts.md) | Copy-paste build prompts, one per phase |
| 10 | [Validation Plan](docs/10-validation.md) | How to test the market for $0 |

Also: [CLAUDE.md](CLAUDE.md) — repo rules the coding agent reads every session.

## TL;DR of the plan

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + Motion + Dexie (IndexedDB) + Supabase (Postgres/Auth) + Serwist (PWA).
- **Local-first:** IndexedDB is the source of truth. Supabase is the sync target. App works fully offline; sign-in is optional.
- **Design:** Calm premium iOS. Warm neutrals, one sage accent, soft depth, spring motion. *Not* the neon-red/black of the reference.
- **Cost:** $0 until you have real users. See [08-deployment.md](docs/08-deployment.md) for the two free-tier traps.

## Quick start (after docs are approved)

```bash
npx create-next-app@latest . --ts --tailwind --app --eslint --src-dir --import-alias "@/*"
# then follow docs/07-roadmap.md Phase 0
```
