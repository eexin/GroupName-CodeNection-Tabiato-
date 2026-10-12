import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { TripForm } from "@/features/trips/components/trip-form";
import { getFriends } from "@/features/trips/friends";

/** 16 New memory trip. */
export default async function NewTripPage() {
  const { supabase, user } = await requireUser();
  const friends = await getFriends(supabase, user.id);
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href="/" title="New memory trip" />
      <div className="px-6"><TripForm friends={friends} /></div>
    </main>
  );
}
