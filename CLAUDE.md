# Tabiato 旅跡 — project brief for AI coding tools

Read this before writing code. It is loaded automatically by Claude Code.

## What we are building

A travel **memory** app. Users upload photos; we read GPS and time and group them into the
**places** they visited. A place holds photos, spend, a rating, notes, and comments from
everyone on the trip. When a trip ends, the AI ("Ato", a goldfish) writes a memory book from
those records. Planning is a secondary feature behind one button.

The unit of the product is **a place, not a photo.** If a change stores data on a photo that
belongs on a place, it is wrong.

Design source of truth: Figma file `FTZudZVL2X3PsmlvoPtUJv` ("Codenection HACKATHON").
Screens are numbered (05 Home, 10 Location Detail, 27 Memory Book page…). Refer to them by
number in commits and PRs.

## Repo layout

```
/README.md            submission document — do not restructure
/docs/                ARCHITECTURE.md, ACCESSIBILITY.md, DEPLOY.zh.md (step-by-step deploy), assets
/supabase/schema.sql  database, RLS policies, storage bucket — single source of truth
/n8n/                 the AI workflow and how to host it
/.github/workflows/   ci.yml (every push/PR), uptime.yml (every 30 min)
/web/                 the Next.js app (Vercel Root Directory = web)
  src/app/            routes only — thin pages
  src/features/<f>/   one folder per feature: actions.ts, data/queries, pure logic, components/
  src/components/     shared UI with no feature knowledge (pwa.tsx: service worker + install prompt)
  src/app/manifest.ts, public/sw.js, public/icons/   what makes it an installable app — sw.js never caches pages
  src/lib/            shared infra: supabase/, ai/ (the AI gateway), geo, time, people, categories, types
  tests/              logic + utils (npm test), smoke (npm run test:smoke)
  scripts/seed-demo.ts  npm run seed
```

**Dependency rule:** app → features → lib/components, never the reverse. ESLint enforces it —
see docs/ARCHITECTURE.md. Put new code in the feature it belongs to.

## Stack — note the versions, several APIs changed

- **Next.js 16**, App Router, React 19, TypeScript. Read `web/node_modules/next/dist/docs/`
  before using an API you are not sure about.
  - `middleware.ts` is now **`proxy.ts`**, exporting `proxy()`.
  - `params` and `searchParams` are **Promises**: `const { id } = await params`.
  - `cookies()` and `headers()` are **async**.
- **Tailwind v4** — tokens live in `web/src/app/globals.css` under `@theme`. There is no
  `tailwind.config.js`.
- **MapLibre GL 6** — named exports only: `import { Map, Marker } from "maplibre-gl"`.
  No default export.
- **Supabase** via `@supabase/ssr` 0.12. Server client per request; never share one.
- **exifr** for EXIF. Import it dynamically inside client handlers
  (`await import("exifr")`) so it never runs during server prerender.
- **Groq** for LLM calls, server-side only.

## Design rules

- Every text colour meets WCAG AA 4.5:1 — see docs/ACCESSIBILITY.md. Gold text on light
  backgrounds is `text-sand-ink`, never `text-sand`; warnings use `text-amber-ink`.
- Use tokens, never raw hex: `bg-paper`, `bg-card`, `bg-surface`, `text-ink`, `text-body`,
  `text-muted`, `bg-coral`, `bg-deep`, `bg-aqua`, `text-sand`, `shadow-card`, `shadow-sheet`.
- Mobile-first. Content column is `max-w-[430px] mx-auto`. Respect `env(safe-area-inset-*)`.
- Font is Poppins (bundled locally). Weights 400, 500, 700 only.
- When the AI is speaking, show **Ato** (`<Ato />` from `components/ato.tsx`) and write the
  copy in first person as Ato: "I noticed…", "I can pin them to 3 places."
- Copy: sentence case, plain verbs, buttons say what happens ("Save memory", not "Submit").
  Empty states point to the next action; errors say what went wrong and how to fix it.

## Product rules — these are features, do not "simplify" them away

1. **Never guess a location.** If a photo has no GPS, the user places it. Never infer from a
   neighbouring photo. Suggestions are allowed only if the user must confirm them.
2. **Read EXIF in the browser before upload** and send coordinates as separate fields. Image
   compression strips EXIF; the coordinates must already be saved.
3. For photos taken in-app with the camera, record `navigator.geolocation` at capture time
   and store it with `location_source = 'device'`.
4. **Photos are the only required input.** Spend, rating and notes are optional, always.
5. In the planner, **places the user added are locked** — the AI may order around them but
   never move or drop them. Mark them "yours" in the UI.
6. **Notes are never public**, even on a public trip.

## AI rules

- All AI goes through `aiJSON(task, …)` in `src/lib/ai/index.ts`: cache → n8n (`N8N_WEBHOOK_URL`) →
  Groq direct → null. Never call a model from anywhere else. New task? Add it to the `AiTask` type
  AND to the **Pick model for task** node in `/n8n/tabiato-ai.json`, or n8n replies 502.

- Compute every number and every observation in code (`features/memory-book/facts.ts`). The model only writes
  prose from those facts and is validated with zod; anything it returns for an unknown place is
  dropped. The planner is the one place the model decides: it picks among REAL places the code
  found (`features/planner/ai-plan.ts`), and code enforces pins, real places and times afterwards. Every AI call has a template fallback, so the app works with no `GROQ_API_KEY`.
- Model is `GROQ_MODEL` (default `openai/gpt-oss-120b`) — check the model list in your Groq playground.

## Data and security

- Schema: `supabase/schema.sql`. Change it there first, then apply in the Supabase SQL editor.
- Every table under a trip carries `trip_id`. Access is checked with `is_trip_member(trip_id)`
  in RLS. **Do not bypass RLS from the browser** and do not use the service-role key in any
  client component.
- Photo files go to the private `photos` bucket at `<trip_id>/<uuid>.<ext>`. The first folder
  must be the trip id or the upload is refused.
- `llm_cache` is server-only; write it with the service-role key from a server action.

## Secrets

`web/.env.local` is never committed. Only these are allowed to start with `NEXT_PUBLIC_`:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `GROQ_API_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` must never be prefixed — that would ship them to every browser.

## Commands (run inside `web/`)

```bash
npm run dev      # http://localhost:3000
npm run lint
npx tsc --noEmit
npm test               # unit tests
npm run test:coverage  # with coverage
npm run test:smoke     # HTTP smoke tests (after npm run build)
npm run typecheck
npm run build    # must pass before opening a PR
```

## Git

Never push to `main`. One branch per task (`feature/<lane>-<task>`), open a PR, one teammate
looks before merging. Pull `main` every morning.
