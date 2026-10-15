import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import type { Profile } from "@/lib/types";
import { DressUp } from "@/features/profile/components/dress-up";
import { decodeLook, lookFromSeed, lookFromUrl } from "@/lib/character";

/** Dress up — your character (from Profile 24 or Onboarding 04). */
export default async function DressUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // requireUser, not requireProfile: new users come here from onboarding before they finish it
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams]);
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = (data ?? { avatar_url: null, settings: null }) as Pick<Profile, "avatar_url" | "settings">;
  // only back to a page of this app
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/profile";
  const current = lookFromUrl(profile.avatar_url);
  const initial = current ?? decodeLook(profile.settings?.look) ?? lookFromSeed(user.id);
  const usingPhoto = Boolean(profile.avatar_url && !current);
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] wide:max-w-4xl wide:pt-4">
      <BackHeader href={next} title="Dress up" subtitle="Everything here is free. Mix and match." />
      <DressUp initial={initial} usingPhoto={usingPhoto} next={next} />
    </main>
  );
}
