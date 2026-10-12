"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/features/auth/guards";
import type { Settings } from "@/lib/types";

const KEYS: (keyof Settings)[] = ["auto_pin", "friends_can_add", "ato_insights"];

/** Figma 24 MEMORY switches. */
export async function setSetting(key: keyof Settings, on: boolean) {
  if (!KEYS.includes(key)) return;
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
  await supabase.from("profiles").update({ settings: { ...(data?.settings ?? {}), [key]: on } }).eq("id", user.id);
  revalidatePath("/profile");
}

const THEMES = ["water", "forest", "night"] as const;

/** Figma 24 map theme. Saved to the profile, and mirrored in a cookie so every map can read it. */
export async function setMapTheme(theme: (typeof THEMES)[number]) {
  if (!THEMES.includes(theme)) return;
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
  await supabase.from("profiles").update({ settings: { ...(data?.settings ?? {}), map_theme: theme } }).eq("id", user.id);
  (await cookies()).set("tabiato_theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** Figma 04 "Add a photo" — the client uploads to avatars/<uid>/…; this records the public URL. */
export async function setAvatar(url: string) {
  const { supabase, user } = await requireUser();
  if (!url.includes(`/avatars/${user.id}/`)) return;
  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  revalidatePath("/", "layout");
}
