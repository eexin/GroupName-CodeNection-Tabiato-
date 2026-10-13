"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/features/auth/guards";
import type { Settings } from "@/lib/types";
import { decodeLook, encodeLook, lookFromSeed, lookFromUrl, lookUrl } from "@/lib/character";

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
  const { data } = await supabase.from("profiles").select("avatar_url, settings").eq("id", user.id).single();
  // the character the photo replaces stays saved, so switching back brings it straight back
  const look = lookFromUrl(data?.avatar_url);
  await supabase.from("profiles").update({
    avatar_url: url,
    settings: { ...(data?.settings ?? {}), photo_url: url, ...(look ? { look: encodeLook(look) } : {}) },
  }).eq("id", user.id);
  revalidatePath("/", "layout");
}

/** Dress up → "Save my look". The character becomes the profile picture; any photo stays saved. */
export async function saveLook(code: string): Promise<{ error?: string }> {
  const look = decodeLook(code);
  if (!look) return { error: "I couldn't read that look. Try again." };
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("avatar_url, settings").eq("id", user.id).single();
  const settings: Settings = { ...(data?.settings ?? {}), look: encodeLook(look) };
  // someone who uploaded a photo before photo_url existed: keep it so they can switch back
  if (data?.avatar_url && !lookFromUrl(data.avatar_url) && !settings.photo_url) settings.photo_url = data.avatar_url;
  await supabase.from("profiles").update({ avatar_url: lookUrl(look), settings }).eq("id", user.id);
  revalidatePath("/", "layout");
  return {};
}

/** Profile → "Use my photo" / "Use my character". Nothing is deleted either way. */
export async function switchAvatar(to: "photo" | "character") {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("avatar_url, settings").eq("id", user.id).single();
  const settings: Settings = { ...(data?.settings ?? {}) };
  const current = data?.avatar_url ?? null;
  if (to === "photo") {
    const photo = settings.photo_url ?? (current && !lookFromUrl(current) ? current : null);
    if (!photo) return;
    const look = lookFromUrl(current);
    if (look) settings.look = encodeLook(look);
    await supabase.from("profiles").update({ avatar_url: photo, settings }).eq("id", user.id);
  } else {
    if (current && !lookFromUrl(current)) settings.photo_url = current;
    const look = decodeLook(settings.look) ?? lookFromSeed(user.id);
    await supabase.from("profiles").update({ avatar_url: lookUrl(look), settings }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
}
