import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/guards";
import { tripDay } from "@/features/live/live-logic";
import { Rerouting } from "./rerouting";

export default async function ReroutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("name, start_date, end_date").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const d = tripDay(trip, new Date().toISOString().slice(0, 10));
  return <Rerouting tripId={id} tripName={trip.name} daysLeft={d ? d.len - d.n + 1 : 1} />;
}
