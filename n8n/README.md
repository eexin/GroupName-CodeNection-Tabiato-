# n8n — Tabiato's AI pipeline

Every AI call in the app goes through `tabiato-ai.json`:

```
Tabiato request ─► Pick model for task ─► Groq ─► Parse JSON ─► Reply to Tabiato
 (secret header)        (per task)                                    │
        any step fails ────────────────────────────────────► Reply with error (502)
```

The app sends `{ task, system, user }` and expects `{ ok: true, data }`. It validates `data` again,
so a bad model answer never reaches the database. If n8n is asleep or down, the app calls Groq
directly, and if that fails too it uses template text — the demo never breaks on AI.

Tested on n8n 1.123.82: correct secret returns the result, wrong secret returns 403, an unknown
task returns 502, and Groq being unreachable returns 502.

Tasks and models (edit them in the **Pick model for task** node — no app redeploy needed):

| task | used by | model |
| --- | --- | --- |
| memory_book | the memory book | openai/gpt-oss-120b |
| plan_itinerary | the whole AI itinerary | openai/gpt-oss-120b |
| plan_places | backup place names when OpenStreetMap is busy, and city suggestions when someone types a whole country (the app checks each one on the map) | openai/gpt-oss-120b |
| plan_stays | "Where to stay": picks 3 real hotels near the plan and says why | openai/gpt-oss-120b |
| insight | travel insights line | openai/gpt-oss-120b |
| intel_notes | trip intel notes | openai/gpt-oss-120b |
| hazard_advice | travel alert suggestion | openai/gpt-oss-120b |
| rain_replan | rain replan card | openai/gpt-oss-20b |
| plan_titles | day titles (rules planner only) | openai/gpt-oss-20b |
| note_draft | Ato's draft note | openai/gpt-oss-20b |
| search_summary | search summary | openai/gpt-oss-20b |
| receipt_scan | "Scan a receipt": total, currency and shop from a photo (the photo is sent once and never stored) | qwen/qwen3.6-27b (needs a model that sees images; thinking off) |

The same node also adds Ato's voice to each task: a storybook voice for the memory book, a
cheerful one for most tasks, and a calm one for safety (alerts, trip intel). Edit the `BOOK`,
`CUTE` and `CALM` texts to change how Ato sounds, then clear old answers with
`delete from llm_cache;` in the app's Supabase SQL editor.

Groq renames models from time to time, and not every account gets every model (some new accounts
have no Llama models) — check the model list in your Groq playground.

---

## Host it free: Hugging Face Spaces + Supabase

Hugging Face gives a free Docker Space (2 vCPU, 16 GB RAM) but its disk is wiped on restart, so n8n
stores everything in Postgres instead.

### 1. A second Supabase project, just for n8n

Create a **new** Supabase project (the free plan allows two). Do not reuse the app's project: n8n
creates its tables in the `public` schema, and in the app's project those would be reachable
through the app's public API.

Project Settings → Database → **Connection string → Session pooler**. Note the host
(`aws-0-<region>.pooler.supabase.com`), user (`postgres.<project-ref>`) and password. Use the
pooler — Hugging Face cannot reach Supabase's direct IPv6 address.

### 2. The Space

1. huggingface.co → New Space → SDK **Docker** → Blank → Public or Private → Create.
2. Upload `space/Dockerfile` and `space/README.md` from this folder (replace the generated README).
3. Settings → Variables and secrets → add these as **Secrets**:

| Secret | Value |
| --- | --- |
| `DB_POSTGRESDB_HOST` | the pooler host |
| `DB_POSTGRESDB_USER` | `postgres.<project-ref>` |
| `DB_POSTGRESDB_PASSWORD` | the database password |
| `N8N_ENCRYPTION_KEY` | a long random string — **never change it**, or saved credentials become unreadable |
| `N8N_HOST` | `<your-username>-<space-name>.hf.space` |
| `WEBHOOK_URL` | `https://<your-username>-<space-name>.hf.space/` |
| `N8N_EDITOR_BASE_URL` | same as `WEBHOOK_URL` |

Generate random values with `openssl rand -hex 32` (or any password manager).

4. Wait for the build, then open **`https://<your-username>-<space-name>.hf.space`** directly.
   Don't use the huggingface.co page — n8n refuses to load inside its frame.
5. Create the owner account.

### 3. Credentials (n8n → Credentials → Add → Header Auth)

| Name | Header name | Header value |
| --- | --- | --- |
| Tabiato secret | `x-tabiato-secret` | a new long random string |
| Groq API key | `Authorization` | `Bearer gsk_…` (your Groq key) |

### 4. The workflow

Workflows → Import from file → `tabiato-ai.json`. Open **Tabiato request** and pick the
*Tabiato secret* credential; open **Groq** and pick *Groq API key*. Save, then switch the workflow
to **Active**. Its production URL is `https://<host>/webhook/tabiato-ai`.

Check it:

```bash
curl -X POST https://<host>/webhook/tabiato-ai \
  -H 'Content-Type: application/json' -H 'x-tabiato-secret: <your secret>' \
  -d '{"task":"plan_titles","system":"Return JSON {\"days\":[{\"day\":1,\"title\":\"test\"}]}","user":"[]"}'
```

### 5. Point the app at it

In `web/.env.local` and in Vercel:

```
N8N_WEBHOOK_URL=https://<host>/webhook/tabiato-ai
N8N_SECRET=<the same secret as the credential>
GROQ_API_KEY=gsk_…      # keep it: the fallback when n8n is asleep
```

### Before a demo

Free Spaces go to sleep after about two days without traffic, and the first request then takes up
to a minute. Open the Space URL a few minutes before presenting. The app waits 30 seconds for n8n
and then falls back to Groq, so a sleeping Space slows one call; it never breaks the app.
