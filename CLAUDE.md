# Sukun — repo rules

A calm Pomodoro web app. Local-first PWA on Next.js 16 + Supabase, deployed on Vercel.

**Sukun** · سكون — Arabic for *stillness*, and the diacritic that marks a pause. The mark is a small circle; so is the focus ring. Brand spec in `docs/04-design-system.md` §0.1.

## Read before coding

The `docs/` directory is the spec, not background reading. Before any task, read the docs that cover it:

| Working on | Read |
|-----------|------|
| Anything | `docs/02-architecture.md` |
| Colors, type, motion, components | `docs/04-design-system.md` |
| A screen | `docs/05-screens.md`, that screen's section |
| Types, repo methods, stats | `docs/06-data-contracts.md` |
| SQL, RLS, Dexie schema | `docs/03-database.md` |
| The timer | `docs/02-architecture.md` §3 + `docs/06-data-contracts.md` §2 |

If the code and a doc disagree, the doc wins — or the doc is wrong and you say so before changing code.

## Non-negotiables

1. **No component imports Dexie or `@supabase/supabase-js` directly.** All data access goes through `src/lib/db/repo.ts`.
2. **The timer never decrements a counter.** Remaining time is always `endsAt - Date.now()`. See `docs/02-architecture.md` §3.
3. **No hardcoded colors, radii, shadows, or durations** outside `src/styles/globals.css`. Everything is a token. One exception, already taken: `viewport.themeColor` in `src/app/layout.tsx` is a server-emitted meta tag and cannot read a CSS variable. If a canvas color changes, change it there too.
4. **No new dependencies** without adding a line to `docs/02-architecture.md` §1 and saying why. The stack is decided.
5. **Soft delete only.** Every query filters `deletedAt == null`.
6. **`tabular-nums` on every number that changes over time.**
7. **Never touch `src/lib/timer/machine.test.ts` to make a test pass.** Those tests encode the invariants. Fix the implementation.
8. **The `service_role` key never appears in this repo.** RLS is the authorization model.
9. **Analytics get events, never user content.** No task titles, notes, or tag names leave the device.
10. **44px minimum touch targets, visible focus rings, `prefers-reduced-motion` respected.** Not a polish phase — write it this way the first time.

## Conventions

- camelCase in TypeScript, snake_case in Postgres. Conversion lives only in `src/lib/sync/mappers.ts`.
- IDs are `crypto.randomUUID()`, generated client-side.
- Client components by default — the data is in the browser. Server components for the shell only.
- Motion for animation, with the spring tokens from `docs/04-design-system.md` §4. No CSS transitions on anything interactive.
- Charts are hand-rolled SVG. No chart library.
- Lucide icons only, `stroke-width: 1.75`.

## Commands

```bash
npm run dev          # localhost:3000
npm run build        # production build — must pass before any commit
npm run test         # Vitest
npm run test:e2e     # Playwright
npm run lint
npx supabase db push # apply migrations
```

## Working style

- One roadmap phase per session (`docs/07-roadmap.md`). Check the done-criteria before calling a phase finished.
- Report what actually happened. If tests fail, show the output. If something was skipped, say which and why.
- Don't expand scope. The v1 cut list in `docs/01-prd.md` §5 is deliberate — no AI features, no teams, no integrations.
