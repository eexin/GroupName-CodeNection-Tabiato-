import Link from "next/link";
import { rerouteForRain } from "@/features/live/actions";
import { Ato } from "@/components/ato";
import { HAZARD_LABEL } from "@/features/live/hazards";
import { tripLive, type TripRow } from "@/features/live/live";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { money, myr } from "@/lib/currency";

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Figma 32 — live trip: weather, Ato's rain replan, hazard alerts, link to intel. */
export async function LivePanel({ trip, dismissed }: { trip: TripRow; dismissed: boolean }) {
  const supabase = await createClient();
  const live = await tripLive(supabase, trip);
  if (!live) {
    return <p className="mt-4 rounded-[14px] bg-surface px-4 py-3 text-[11.5px] text-muted">Add a destination to this trip to see weather, alerts and travel intel.</p>;
  }
  const muted: string[] = JSON.parse((await cookies()).get("tabiato_muted")?.value ?? "[]");
  const { weather, replan } = live;
  // Figma 32 "Today so far" — local day from the forecast, or today's date as a fallback
  const today = weather?.today ?? new Date().toISOString().slice(0, 10);
  const [{ data: todays }, { data: spent }] = await Promise.all([
    supabase.from("photos").select("place_id").eq("trip_id", trip.id).gte("taken_at", `${today}T00:00:00Z`).lt("taken_at", `${today}T23:59:59Z`),
    supabase.from("expenses").select("amount, currency, amount_myr").eq("trip_id", trip.id).gte("created_at", `${today}T00:00:00Z`),
  ]);
  const so = { photos: todays?.length ?? 0, places: new Set((todays ?? []).map((p) => p.place_id).filter(Boolean)).size, spend: (spent ?? []).reduce((s, e) => s + myr(e), 0) };
  const hazards = live.hazards.filter((h) => !muted.includes(`${trip.id}:${h.id}`));
  return (
    <div className="mt-4 space-y-3">
      <section aria-label="Today so far" className="rounded-[16px] bg-card p-4 shadow-card">
        <p className="text-[10.5px] font-bold text-muted">TODAY SO FAR</p>
        <dl className="mt-2 grid grid-cols-3 text-center">
          {([[so.photos, "photos"], [so.places, "places"], [money(Math.round(so.spend)), "spent"]] as const).map(([n, l]) => (
            <div key={l}><dd className="text-[17px] font-bold text-ink">{n}</dd><dt className="text-[10px] text-muted">{l}</dt></div>
          ))}
        </dl>
      </section>
      {hazards.map((h) => (
        <Link key={h.id} href={`/trips/${trip.id}/alert?id=${encodeURIComponent(h.id)}`}
          className="flex items-center gap-3 rounded-[16px] border-l-4 border-[#c4681c] bg-[#fff3e2] px-4 py-3 shadow-card">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-ink text-[13px] font-bold text-white">!</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold text-[#8e3f13]">
              {h.demo && <span className="mr-1.5 rounded bg-[#8e3f13] px-1.5 py-0.5 text-[9px] text-white">DEMO</span>}
              {HAZARD_LABEL[h.type] ?? h.type} · {h.level} alert
            </span>
            <span className="block text-[10.5px] text-amber-ink">{h.name}, about {h.km} km away</span>
          </span>
          <span className="text-[12px] text-amber-ink">›</span>
        </Link>
      ))}

      {weather?.summary && (
        <div className="flex items-center justify-between rounded-[16px] bg-card px-4 py-3 shadow-card">
          <span>
            <span className="block text-[12.5px] font-bold text-ink">Today, {weather.summary.min}–{weather.summary.max}°C</span>
            <span className="block text-[10.5px] text-muted">
              {weather.rain ? `Rain likely ${pad(weather.rain.from)}–${pad(weather.rain.to)} (${weather.rain.peak}%)` : `Rain chance up to ${weather.summary.rainMax}%`}
            </span>
          </span>
          <span className="text-[9.5px] text-muted">Open-Meteo</span>
        </div>
      )}

      {replan && !dismissed && (
        <div className="rounded-[18px] border-l-4 border-coral bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <Ato size={52} />
            <div className="min-w-0 flex-1">
              <p className="text-[9.5px] font-bold text-coral">ADAPTIVE REPLAN</p>
              <p className="text-[14px] font-bold text-ink">{replan.headline}</p>
              <p className="mt-1 text-[12px] leading-snug text-body">{replan.suggestion}</p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Link href={`/trips/${trip.id}?dismiss=rain`} className="rounded-full bg-surface px-4 py-2 text-[11.5px] font-bold text-muted">Ignore</Link>
            <form action={rerouteForRain.bind(null, trip.id, replan.day, replan.stopIds)}>
              <button className="rounded-full bg-deep px-4 py-2 text-[11.5px] font-bold text-white">Reroute</button>
            </form>
          </div>
        </div>
      )}

      <Link href={`/trips/${trip.id}/intel`} className="flex items-center justify-between rounded-[16px] bg-card px-4 py-3 shadow-card">
        <span>
          <span className="block text-[12.5px] font-bold text-ink">Trip intel</span>
          <span className="block text-[10.5px] text-muted">Entry rules, safety advice and travel news for this destination</span>
        </span>
        <span className="text-[12px] text-coral">›</span>
      </Link>
    </div>
  );
}
