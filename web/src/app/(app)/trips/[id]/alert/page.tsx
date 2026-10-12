import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ato } from "@/components/ato";
import { requireUser } from "@/features/auth/guards";
import { HAZARD_LABEL, hazardsNear, type Hazard } from "@/features/live/hazards";
import { hazardImpact, type TripRow } from "@/features/live/live";
import { muteAlert } from "@/features/live/actions";

// n8n on a free host can take a while to wake up
export const maxDuration = 60;

/** 33 Travel alert — a real GDACS event near the trip, what it changes, and Ato's suggestion. */
export default async function AlertPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ id?: string }> }) {
  const [{ id }, { id: hazardId }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireUser();
  const { data } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const trip = data as TripRow;
  if (trip.dest_lat === null || trip.dest_lng === null) redirect(`/trips/${id}`);

  const all: Hazard[] = [...(trip.demo_alert ? [{ ...trip.demo_alert, demo: true }] : []), ...(await hazardsNear(trip.dest_lat, trip.dest_lng))];
  const h = all.find((x) => x.id === hazardId);
  if (!h) redirect(`/trips/${id}`);
  const impact = await hazardImpact(supabase, trip, h);
  const issued = h.from ? new Date(h.from).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "";

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <section className="bg-gradient-to-b from-[#c4681c] to-[#8e3f13] px-6 pb-7 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between">
          <Link href={`/trips/${id}`} className="text-[13px] font-bold">‹ Travel alert</Link>
          <div className="flex items-center gap-2">
            {h.demo && <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold">DEMO</span>}
            <form action={async () => { "use server"; await muteAlert(id, h.id); }}>
              <button className="min-h-[40px] rounded-full bg-white/15 px-4 text-[12px] font-bold">Mute</button>
            </form>
          </div>
        </div>
        <div className="mt-6 grid h-11 w-11 place-items-center rounded-full bg-white/20 text-[20px] font-bold">!</div>
        <p className="mt-4 text-[10.5px] font-bold text-[#f5d3a8]">{h.level.toUpperCase()} ALERT{issued ? ` · ISSUED ${issued} UTC` : ""}</p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight">{h.name}</h1>
        <p className="mt-2 text-[12.5px] text-[#f5d3a8]">{HAZARD_LABEL[h.type] ?? h.type}{h.country ? `, ${h.country}` : ""} — about {h.km} km from {trip.name}</p>
      </section>

      <div className="space-y-4 px-6 pt-5">
        <div className="rounded-[20px] bg-card p-5 shadow-card">
          <p className="text-[10.5px] font-bold text-amber-ink">WHAT THIS CHANGES</p>
          {impact.outdoor.length ? (
            <ul className="mt-3 space-y-3">
              {impact.outdoor.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-ink" />
                  <span className="flex-1"><span className="block text-[13px] font-bold text-ink">{s.name}</span><span className="text-[10.5px] text-muted">Day {s.day}{s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ""}</span></span>
                  <span className="text-[11px] font-medium text-amber-ink">Outdoor · unsafe</span>
                </li>
              ))}
              {impact.indoorSameDay.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-sand" />
                  <span className="flex-1"><span className="block text-[13px] font-bold text-ink">{s.name}</span><span className="text-[10.5px] text-muted">Day {s.day}</span></span>
                  <span className="text-[11px] font-medium text-sand-ink">May close early</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12.5px] text-body">None of your planned stops are outdoors, but stay aware of local conditions.</p>}
        </div>

        <div className="flex items-start gap-3 rounded-[20px] border-l-4 border-coral bg-card p-4 shadow-card">
          <Ato size={56} mood="rest" />
          <div>
            <p className="text-[10px] font-bold text-coral">ATO SUGGESTS</p>
            <p className="mt-1 text-[12.5px] leading-snug text-body">{impact.suggestion}</p>
          </div>
        </div>

        <p className="rounded-[14px] bg-surface px-4 py-3 text-[11px] leading-relaxed text-body">
          This is an automated alert from GDACS, not an official warning. Always follow instructions from local authorities.
        </p>
        {impact.outdoor.length > 0 && (
          <Link href={`/trips/${id}/reroute`} className="flex h-[52px] items-center justify-center rounded-[15px] bg-coral text-[15px] font-bold text-white">
            Reschedule Day {impact.outdoor[0].day}
          </Link>
        )}
        <form action={async () => { "use server"; await muteAlert(id, h.id); }}>
          <button className="block w-full py-2 text-center text-[13px] font-bold text-muted">I&apos;m safe · dismiss</button>
        </form>
        {h.url && !h.demo && <a href={h.url} className="block text-center text-[10.5px] text-muted" target="_blank" rel="noreferrer">Source: GDACS event report</a>}
      </div>
    </main>
  );
}
