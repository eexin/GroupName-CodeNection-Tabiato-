import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/features/auth/guards";
import { Building } from "@/app/(app)/plan/[id]/build/building";

// Overpass lookups and the optional model call can take several seconds
export const maxDuration = 60;

export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("name, start_date, end_date, owner_id").eq("id", id).maybeSingle();
  if (!trip) notFound();
  // only the trip leader can (re)build — members can't write the trip record, so a build would half-apply
  if (trip.owner_id !== user.id) redirect(`/plan/${id}`);
  const days = Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1);
  return <Building tripId={id} name={trip.name} days={days} />;
}
