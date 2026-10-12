import { BackHeader } from "@/components/ui";
import { requireProfile } from "@/features/auth/guards";
import { PlanForm } from "@/app/(app)/plan/new/form";

/** 29 Plan a trip. Friends are invited from the plan once it exists. */
export default async function NewPlanPage() {
  const { profile } = await requireProfile();
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href="/plan" title="Plan a trip" />
      <div className="px-6"><PlanForm style={profile.travel_style ?? {}} /></div>
    </main>
  );
}
