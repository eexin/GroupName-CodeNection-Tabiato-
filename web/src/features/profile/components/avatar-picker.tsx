"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAvatar, switchAvatar } from "@/features/profile/settings";
import { prepareImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

/** The profile picture: a photo or the character (lib/character). Decorative next to the name. */
export function ProfilePicture({ src, size = 72 }: { src: string; size?: number }) {
  return <img src={src} alt="" className="shrink-0 rounded-full bg-aqua-light object-cover" style={{ width: size, height: size }} />;
}

/**
 * Figma 24 / 04: what you can do with your picture. Dress up opens the character editor; a photo
 * goes to the public avatars bucket (512px JPEG); the switch flips between the two without
 * deleting either. `tone` matches the dark Profile header or the light onboarding page.
 */
export function AvatarActions({ userId, showing, hasPhoto, next, tone = "dark" }: {
  userId: string; showing: "photo" | "character"; hasPhoto: boolean; next: string; tone?: "dark" | "light";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, startSwitch] = useTransition();
  const pill = `inline-flex min-h-[36px] items-center rounded-full px-3.5 text-[12px] font-bold ${tone === "dark" ? "bg-white/15 text-white" : "bg-surface text-deep"}`;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { blob } = await prepareImage(file, 512);
      const supabase = createClient();
      const path = `${userId}/avatar-${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      await setAvatar(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      router.refresh();
    } catch {
      setError("I couldn't upload that photo. Check your connection, or try a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/profile/avatar?next=${encodeURIComponent(next)}`} className={pill}>
        Dress up
      </Link>
      <label className={`${pill} cursor-pointer`}>
        {busy ? "Uploading…" : hasPhoto ? "New photo" : "Add a photo"}
        <input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={pick} disabled={busy} />
      </label>
      {(showing === "photo" || hasPhoto) && (
        <button type="button" className={pill} disabled={switching}
          onClick={() => startSwitch(async () => { await switchAvatar(showing === "photo" ? "character" : "photo"); router.refresh(); })}>
          {switching ? "…" : showing === "photo" ? "Use my character" : "Use my photo"}
        </button>
      )}
      {error && <p role="alert" className={`w-full text-[11.5px] font-bold ${tone === "dark" ? "text-sand" : "text-coral"}`}>{error}</p>}
    </div>
  );
}
