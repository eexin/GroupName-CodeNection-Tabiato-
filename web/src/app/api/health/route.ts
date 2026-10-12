import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitoring (.github/workflows/uptime.yml pings it).
 * 200 = database reachable. 503 = database down. AI being unreachable is "degraded", not down,
 * because the app falls back to Groq and then to templates.
 */
export async function GET() {
  const started = Date.now();
  const checks: Record<string, { ok: boolean; ms?: number; note?: string }> = {};

  if (!hasSupabase) {
    checks.database = { ok: false, note: "Supabase env vars not set" };
  } else {
    const t = Date.now();
    try {
      const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error } = await db.from("trips").select("id", { head: true, count: "exact" }).limit(1);
      checks.database = { ok: !error, ms: Date.now() - t, note: error?.message };
    } catch (e) {
      checks.database = { ok: false, ms: Date.now() - t, note: String(e) };
    }
  }

  const hook = process.env.N8N_WEBHOOK_URL;
  if (hook) {
    const t = Date.now();
    try {
      const res = await fetch(new URL("/healthz", hook), { signal: AbortSignal.timeout(5000), cache: "no-store" });
      checks.ai_n8n = { ok: res.ok, ms: Date.now() - t };
    } catch {
      checks.ai_n8n = { ok: false, ms: Date.now() - t, note: "asleep or unreachable — Groq fallback in use" };
    }
  }
  checks.ai_fallback = { ok: Boolean(process.env.GROQ_API_KEY), note: process.env.GROQ_API_KEY ? undefined : "no GROQ_API_KEY — template text only" };

  const up = checks.database.ok;
  const degraded = up && Object.values(checks).some((c) => !c.ok);
  return NextResponse.json(
    {
      status: up ? (degraded ? "degraded" : "ok") : "down",
      checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      took_ms: Date.now() - started,
    },
    { status: up ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
