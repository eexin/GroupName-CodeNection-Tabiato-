import { notFound, redirect } from "next/navigation";
import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { TripForm } from "@/features/trips/components/trip-form";
import { getFriends } from "@/features/trips/friends";
import { signedUrls } from "@/lib/storage";

/** Edit memory trip (Figma "edit trip"). Owner only. */
export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  if (trip.owner_id !== user.id) redirect(`/trips/${id}`);
  const [friends, { data: members }, urls] = await Promise.all([
    getFriends(supabase, user.id),
    supabase.from("trip_members").select("user_id").eq("trip_id", id),
    signedUrls(supabase, trip.cover_path ? [trip.cover_path] : []),
  ]);
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href={`/trips/${id}/options`} title="Edit memory trip" />
      <div className="px-6">
        <TripForm friends={friends} members={(members ?? []).map((m) => m.user_id)}
          initial={{ id, name: trip.name, destination: trip.destination, start_date: trip.start_date, end_date: trip.end_date, is_public: trip.is_public, friends_can_view: trip.friends_can_view ?? false, coverUrl: trip.cover_path ? urls[trip.cover_path] ?? null : null }} />
      </div>
    </main>
  );
}
