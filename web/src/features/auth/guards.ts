import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import type { Profile } from "@/lib/types";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Who the caller is. Only the id and email are ever needed. */
export type SignedIn = { id: string; email: string | null };

/**
 * Establishes who is making the request from the session cookie.
 *
 * The signature on the session token is checked here, in this process, against the project's
 * public signing key. Asking the Auth server to do it instead is a round trip — about 250 ms
 * from Malaysia to a Supabase project in Sydney — and every page render and every button press
 * was paying it on top of the one the proxy already pays.
 *
 * If the token can't be verified locally, which is the case for a project still signing with the
 * old shared secret, this falls back to asking the Auth server, exactly as before.
 */
async function identify(supabase: Client): Promise<SignedIn | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!error && typeof claims?.sub === "string") {
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  }
  const { data: checked } = await supabase.auth.getUser();
  return checked.user ? { id: checked.user.id, email: checked.user.email ?? null } : null;
}

/** Every signed-in page starts here. Redirects to /setup, /login or /welcome as needed. */
export async function requireUser() {
  // read the request first so these pages are always rendered per request, never baked at build
  await cookies();
  if (!hasSupabase) redirect("/setup");
  const supabase = await createClient();
  const user = await identify(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function requireProfile() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;
  if (!profile?.onboarded_at) redirect("/welcome");
  return { supabase, user, profile };
}
