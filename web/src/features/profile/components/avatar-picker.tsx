"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAvatar } from "@/features/profile/settings";
import { prepareImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

/** Figma 04 "Add a photo". Square-ish 512px JPEG in the public avatars bucket. */
export function AvatarPicker({ userId, current, initials, size = 72 }: { userId: string; current: string | null; initials: string; size?: number }) {
  const router = useRouter();
  const [url, setUrl] = useState(current);
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { blob } = await prepareImage(file, 512);
      const supabase = createClient();
      const path = `${userId}/avatar-${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (!up.error) {
        const pub = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        await setAvatar(pub);
        setUrl(pub);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <label className="relative inline-grid cursor-pointer place-items-center" aria-label={url ? "Change your photo" : "Add a photo"}>
      {url
        ? <img src={url} alt="Your profile photo" className="rounded-full object-cover" style={{ width: size, height: size }} />
        : <span className="grid place-items-center rounded-full bg-aqua-light text-[20px] font-bold text-deep" style={{ width: size, height: size }}>{initials}</span>}
      <span className="absolute -bottom-1 -right-1 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">{busy ? "…" : url ? "Edit" : "Add a photo"}</span>
      <input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={pick} />
    </label>
  );
}
