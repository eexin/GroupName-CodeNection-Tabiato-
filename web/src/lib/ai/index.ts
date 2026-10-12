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
 * The model only ever writes prose. Numbers, places and decisions are computed in code first,
 * and the output is validated with zod before anything is saved.
 */

export type AiTask = "memory_book" | "insight" | "plan_titles" | "rain_replan" | "hazard_advice" | "intel_notes" | "note_draft" | "search_summary";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

async function viaN8n(task: AiTask, system: string, user: string): Promise<unknown | null> {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_SECRET;
  if (!url || !secret) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tabiato-secret": secret },
      body: JSON.stringify({ task, system, user }),
      signal: AbortSignal.timeout(30_000), // a sleeping free-tier host may take a while to wake
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.data ?? null;
  } catch {
    return null;
  }
}

async function viaGroq(system: string, user: string): Promise<unknown | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL, temperature: 0.6, response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json();
    return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return null;
  }
}

export async function aiJSON<T>(task: AiTask, system: string, user: string, schema: z.ZodType<T>): Promise<T | null> {
  const hash = createHash("sha256").update(`${task}\n${system}\n${user}`).digest("hex");
  const admin = createAdminClient();

  if (admin) {
    const { data } = await admin.from("llm_cache").select("response").eq("prompt_hash", hash).maybeSingle();
    const cached = data ? schema.safeParse(data.response) : null;
    if (cached?.success) return cached.data;
  }

  for (const attempt of [() => viaN8n(task, system, user), () => viaGroq(system, user)]) {
    const raw = await attempt();
    if (raw === null) continue;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) continue;
    if (admin) await admin.from("llm_cache").upsert({ prompt_hash: hash, response: parsed.data });
    return parsed.data;
  }
  return null;
}
