import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ato } from "@/components/ato";
import { Avatars, BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getTrip } from "@/features/trips/data";
import { SetupForm } from "./form";

/** 29 Plan a trip — an existing plan: preferences, who's coming, must-visits, generate. */
export default async function SetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTrip(supabase, id, user.id).catch(() => null);
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  if (trip.status !== "planned") redirect(`/trips/${id}`);
  const { data: stops } = await supabase.from("plan_stops").select("name").eq("trip_id", id).eq("source", "user").order("created_at");
  const people = (t?.members ?? []).filter((m) => m.user_id !== user.id).map((m) => m.person);
  const owner = trip.owner_id === user.id;
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href={`/plan/${id}`} title="Plan a trip" subtitle={trip.destination ?? trip.name} />
      <div className="space-y-5 px-6">
        <section>
          <h2 className="mb-2 text-[11px] font-bold text-ink">Travel with</h2>
          <div className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
            {people.length ? <Avatars people={people} size={34} /> : <span className="text-[12px] text-muted">Just you so far</span>}
            {owner && <Link href={`/trips/${id}/invite`} className="ml-auto min-h-[40px] content-center rounded-full bg-surface px-4 text-[12px] font-bold text-deep">Invite friends</Link>}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-bold text-ink">Must-visit places</h2>
          <p className="mb-2 text-[11px] text-muted">Add your own first — Ato plans around them.</p>
          <Link href={`/plan/${id}/places`} className="flex items-center gap-3 rounded-[18px] border-l-4 border-coral bg-card p-4 shadow-card">
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold text-ink">{stops?.length ? `${stops.length} place${stops.length === 1 ? "" : "s"} added` : "Add your must-visits"}</span>
              <span className="block truncate text-[11px] text-muted">{(stops ?? []).map((s) => s.name).join(", ") || "Search for the places you'd hate to miss"}</span>
            </span>
            <span className="text-coral" aria-hidden>›</span>
          </Link>
        </section>

        {owner ? (
          <SetupForm tripId={id} start={trip.start_date} end={trip.end_date} budget={trip.budget}
            pace={trip.plan_style?.pace ?? "balanced"} interests={trip.plan_style?.interests ?? []} />
        ) : (
          <div className="flex items-center gap-3 text-[12px] text-muted"><Ato size={48} />The trip leader sets dates and preferences.</div>
        )}
      </div>
    </main>
  );
}
