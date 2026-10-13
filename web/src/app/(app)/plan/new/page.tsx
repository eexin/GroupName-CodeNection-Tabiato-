import { BackHeader } from "@/components/ui";
import { requireProfile } from "@/features/auth/guards";
import { PlanForm } from "@/app/(app)/plan/new/form";
import { learnForUser } from "@/features/planner/learn";

/** 29 Plan a trip. Friends are invited from the plan once it exists. */
export default async function NewPlanPage() {
  const { supabase, user, profile } = await requireProfile();
  // what your finished trips say about how you travel; empty until you have finished one
  const learned = await learnForUser(supabase, user.id);
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href="/plan" title="Plan a trip" />
      <div className="px-6"><PlanForm style={profile.travel_style ?? {}} suggested={{ pace: learned.pace ?? null, interests: learned.interests ?? [] }} /></div>
    </main>
  );
}
