# Architecture

```
web/src/
  app/          routes only — thin pages that call features
  features/     one folder per feature: its server actions, queries, logic and feature-only UI
    auth  profile  trips  places  friends  memory-book  insights  planner  live
  components/   shared UI with no feature knowledge (Ato, buttons, map, nav)
  lib/          shared infrastructure: supabase clients, the AI gateway, geo/time/people utils, types
```

**Dependency rule:** `app → features → lib / components`. Never the other way. Enforced by ESLint
(`no-restricted-imports` in `eslint.config.mjs`), so a violation fails CI rather than slipping in.

**Screen sizes:** three layouts from one set of pages, chosen in CSS (`web/src/app/globals.css`):

| Screen | Variant | Layout |
| --- | --- | --- |
| Phone held upright | (none) | one 430px column, bottom nav, floating camera / comment / like bars |
| Phone or small tablet turned sideways | `wide:` + `land:` | icon rail on the left, two columns, pictures shorter (a phone on its side is ~390px tall) |
| Computer, 1024px and up | `wide:` + `desk:` | full sidebar, two columns |

Under `wide:` nothing floats over content: bars that are pinned to the bottom on a phone sit in the
page instead. Two-column pages either name their columns with grid areas or use `TWO_COLUMNS`
(`lib/layout.ts`). Code that needs the same test in JavaScript uses `WIDE_QUERY` from there.

**Data access:** every query runs as the signed-in user, so Postgres row-level security decides
what is visible (`supabase/schema.sql`, 35+ policies, tested). The service-role key is used only
for the AI cache and the demo seed.

**AI:** one gateway, `lib/ai/index.ts` — cache → n8n workflow → Groq direct → template text. Numbers
and decisions are computed in code (`features/memory-book/facts.ts`, `features/planner/itinerary.ts`);
the model only writes prose, validated with zod.

**External data:** OpenFreeMap tiles, Nominatim, Overpass, Open-Meteo, GDACS, GOV.UK FCDO,
NewsData.io — each behind one module in `features/`, cached with `next.revalidate` or a table.

**Tests:** `npm test` (unit, ~99% line coverage of the pure logic), `npm run test:smoke` (HTTP
against the production build), both in CI on every push and pull request. `/api/health` is checked
every 30 minutes by `.github/workflows/uptime.yml`.
