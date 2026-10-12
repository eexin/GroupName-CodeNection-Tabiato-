import { getTrip } from "@/features/trips/data";
import { currencyForCountry } from "@/lib/currency";
import { notFound, redirect } from "next/navigation";
import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { Uploader } from "@/app/(app)/trips/[id]/upload/uploader";

/** 17 → 19 Add memories. Only joined members of an ongoing trip can add. */
// clustering names new places via Nominatim at 1 request/second; the AI book can take a few seconds
export const maxDuration = 60;

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("id, name, status, country_code").eq("id", id).maybeSingle();
  const t = await getTrip(supabase, id, user.id);
  if (!trip) notFound();
  const { data: me } = await supabase.from("trip_members").select("status, role").eq("trip_id", id).eq("user_id", user.id).maybeSingle();
  if (me?.status !== "joined" || me.role === "viewer" || trip.status !== "ongoing") redirect(`/trips/${id}`);
  const { data: profile } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href={`/trips/${id}`} title="Add photos" subtitle={trip.name} />
      <Uploader tripId={id} tripName={trip.name} userId={user.id} autoPin={profile?.settings?.auto_pin !== false}
        members={(t?.members ?? []).filter((m) => m.status === "joined").map((m) => m.person)} currency={currencyForCountry(trip.country_code)} />
    </main>
  );
}
