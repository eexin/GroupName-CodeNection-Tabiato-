import { AvatarActions, ProfilePicture } from "@/features/profile/components/avatar-picker";
import { avatarFor } from "@/lib/people";
import { lookFromUrl } from "@/lib/character";
import { requireUser } from "@/features/auth/guards";
import { BackHeader } from "@/components/ui";
import type { Profile } from "@/lib/types";
import { OnboardingForm } from "@/app/onboarding/form";
import { nextQuery, safeNext } from "@/lib/safe-next";

/** 04 Profile setup. Also reachable later from Profile → Edit travel profile. */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10">
      <BackHeader href={profile?.onboarded_at ? "/profile" : "/welcome"} title={profile?.onboarded_at ? "Travel profile" : "Set up your profile"} />
      <div className="px-6">
        <div className="mb-5 flex flex-col items-center gap-3">
          <ProfilePicture src={avatarFor(user.id, profile?.avatar_url)} size={84} />
          <AvatarActions userId={user.id} next={`/onboarding${nextQuery(next)}`} tone="light"
            showing={profile?.avatar_url && !lookFromUrl(profile.avatar_url) ? "photo" : "character"}
            hasPhoto={Boolean(profile?.settings?.photo_url || (profile?.avatar_url && !lookFromUrl(profile.avatar_url)))} />
        </div>
        <OnboardingForm name={profile?.display_name ?? ""} username={profile?.username ?? ""} style={profile?.travel_style ?? {}} next={next} />
      </div>
    </main>
  );
}
