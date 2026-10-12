import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Photos live in a private bucket; the browser gets short-lived signed URLs. */
export async function signedUrls(supabase: SupabaseClient, paths: string[], seconds = 3600) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from("photos").createSignedUrls(unique, seconds);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
