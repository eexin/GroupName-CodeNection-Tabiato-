import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every AI call in the app goes through here.
 *
 *   1. cache (llm_cache)        — a repeated demo never re-bills and never hits a rate limit
 *   2. n8n  (N8N_WEBHOOK_URL)   — the primary path; the workflow lives in /n8n/tabiato-ai.json
 *   3. Groq directly            — fallback if n8n is asleep or down
 *   4. null                     — callers always have a template fallback
 *
 * The model writes prose, and in the planner it chooses among real places the code found for it.
 * Numbers and facts are computed in code first, and every output is validated with zod (and, for
 * the itinerary, checked against the real place list) before anything is saved.
 */

export type AiTask = "memory_book" | "insight" | "plan_titles" | "plan_itinerary" | "plan_places" | "plan_stays" | "rain_replan" | "hazard_advice" | "intel_notes" | "note_draft" | "search_summary" | "receipt_scan";

// gpt-oss is on every Groq account; some new accounts have no Llama models at all
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// reading a photo (receipts) needs a model that sees images
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";

async function viaN8n(task: AiTask, system: string, user: string, timeoutMs: number, image?: string): Promise<unknown | null> {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_SECRET;
  if (!url || !secret) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tabiato-secret": secret },
      body: JSON.stringify({ task, system, user, ...(image ? { image } : {}) }),
      signal: AbortSignal.timeout(timeoutMs), // a sleeping free-tier host may take a while to wake
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.data ?? null;
  } catch {
    return null;
  }
}

async function viaGroq(system: string, user: string, timeoutMs: number, image?: string): Promise<unknown | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const model = image ? GROQ_VISION_MODEL : GROQ_MODEL;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: image ? 0 : 0.6, response_format: { type: "json_object" },
        // gpt-oss thinks before it answers; a little thinking is plenty for JSON and much faster
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : model.startsWith("qwen/") ? { reasoning_effort: "none" } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: image ? [{ type: "text", text: user }, { type: "image_url", image_url: { url: image } }] : user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json();
    return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return null;
  }
}

/**
 * timeoutMs: how long to wait for each of n8n and Groq. Callers with a tight time budget lower it.
 * image: a data: URL the model should look at (receipts). It is sent once and never stored —
 * image calls skip the cache entirely.
 */
export async function aiJSON<T>(task: AiTask, system: string, user: string, schema: z.ZodType<T>, opts: { timeoutMs?: number; image?: string } = {}): Promise<T | null> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const image = opts.image;
  const hash = createHash("sha256").update(`${task}\n${system}\n${user}`).digest("hex");
  const admin = image ? null : createAdminClient();

  if (admin) {
    const { data } = await admin.from("llm_cache").select("response").eq("prompt_hash", hash).maybeSingle();
    const cached = data ? schema.safeParse(data.response) : null;
    if (cached?.success) return cached.data;
  }

  for (const attempt of [() => viaN8n(task, system, user, timeoutMs, image), () => viaGroq(system, user, timeoutMs, image)]) {
    const raw = await attempt();
    if (raw === null) continue;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) continue;
    if (admin) await admin.from("llm_cache").upsert({ prompt_hash: hash, response: parsed.data });
    return parsed.data;
  }
  return null;
}
