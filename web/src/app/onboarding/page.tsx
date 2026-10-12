import { AvatarPicker } from "@/features/profile/components/avatar-picker";
import { requireUser } from "@/features/auth/guards";
import { BackHeader } from "@/components/ui";
import type { Profile } from "@/lib/types";
import { OnboardingForm } from "@/app/onboarding/form";

/** 04 Profile setup. Also reachable later from Profile → Edit travel profile. */
export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10">
      <BackHeader href={profile?.onboarded_at ? "/profile" : "/welcome"} title={profile?.onboarded_at ? "Travel profile" : "Set up your profile"} />
      <div className="px-6">
        <div className="mb-5 flex justify-center"><AvatarPicker userId={user.id} current={profile?.avatar_url ?? null} initials={(profile?.display_name || "?").slice(0, 2).toUpperCase()} size={84} /></div>
        <OnboardingForm name={profile?.display_name ?? ""} username={profile?.username ?? ""} style={profile?.travel_style ?? {}} />
      </div>
    </main>
  );
}
