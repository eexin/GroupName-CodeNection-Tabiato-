import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { endTrip } from "@/features/trips/actions";
import { Ato } from "@/components/ato";
import { requireUser } from "@/features/auth/guards";

/** 32b End trip — irreversible for photo capture, so it asks first. */
export default async function EndTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  if (trip.owner_id !== user.id || trip.status !== "ongoing") redirect(`/trips/${id}`);
  const [{ count: photos }, { count: places }] = await Promise.all([
    supabase.from("photos").select("*", { count: "exact", head: true }).eq("trip_id", id),
    supabase.from("places").select("*", { count: "exact", head: true }).eq("trip_id", id),
  ]);

  return (
    <main className="mx-auto grid min-h-dvh max-w-[430px] place-items-center lg:max-w-none bg-deeper/90 px-8">
      <div className="w-full max-w-[400px] rounded-[26px] bg-card p-6 shadow-sheet">
        <div className="flex items-start justify-between">
          <h1 className="text-[22px] font-bold text-ink">End this trip?</h1>
          <Ato size={80} mood="happy" />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-body">You can still add photos to {trip.name} afterwards, and I&apos;ll offer to rewrite the story.</p>
        <p className="mt-3 text-[13px] leading-relaxed text-body">
          I&apos;ll read the {photos ?? 0} memories you logged across {places ?? 0} places and write your trip story.
        </p>
        <form action={endTrip.bind(null, id)} className="mt-6">
          <button className="h-12 w-full rounded-[14px] bg-coral text-[13.5px] font-bold text-white">End trip &amp; write my story</button>
        </form>
        <Link href={`/trips/${id}`} className="mt-3 block py-2 text-center text-[13px] font-bold text-muted">Keep recording</Link>
      </div>
    </main>
  );
}
