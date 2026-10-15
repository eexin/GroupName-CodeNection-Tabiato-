import { notFound, redirect } from "next/navigation";
import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getTrip } from "@/features/trips/data";
import { Placer } from "@/app/(app)/trips/[id]/place-photos/placer";

/** Photos without location data get placed by hand — never guessed. */
// clustering names new places via Nominatim at 1 request/second; the AI book can take a few seconds
export const maxDuration = 60;

export default async function PlacePhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTrip(supabase, id, user.id);
  if (!t) notFound();
  if (!t.isMember || !t.unplaced.length) redirect(`/trips/${id}`);
  const pins = t.places.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, count: p.photos, label: p.name }));
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 wide:max-w-5xl wide:pt-4">
      <BackHeader href={`/trips/${id}`} title="Place your photos" subtitle={`${t.unplaced.length} without a location`} />
      <Placer tripId={id} photos={t.unplaced} pins={pins}
        near={t.trip.dest_lat !== null && t.trip.dest_lng !== null ? { lat: t.trip.dest_lat, lng: t.trip.dest_lng } : pins[0] ?? null} />
    </main>
  );
}
