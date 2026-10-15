import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { startTrip } from "@/features/planner/actions";
import { Ato } from "@/components/ato";
import { MemoryMap } from "@/components/memory-map";
import { BackHeader, Empty, buttonClass } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { CATEGORY_LABEL, type Category } from "@/lib/categories";
import { distanceM, mapsLink } from "@/lib/geo";
import { TIER_LABEL, type Eat, type Stay, type Tier } from "@/features/planner/stays";
import { formatRange } from "@/lib/time";

const KIND_LABEL: Record<string, string> = { hotel: "Hotel", hostel: "Hostel", guest_house: "Guest house", apartment: "Apartment", motel: "Motel" };

type Stop = { id: string; name: string; lat: number; lng: number; category: string | null; source: "user" | "ato"; reason: string | null; day: number | null; position: number | null; start_time: string | null; duration_min: number | null };

/** 31 AI Itinerary — day tabs, your stops tagged "yours", Start trip turns it into a memory trip. */
export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  if (trip.status !== "planned") redirect(`/trips/${id}`);
  const { data } = await supabase.from("plan_stops").select("*").eq("trip_id", id).order("day").order("position");
  const stops = (data ?? []) as Stop[];
  const built = Boolean(trip.plan_style?.built_at) && stops.some((s) => s.day !== null);
  const days = Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1);
  const day = Math.min(days, Math.max(1, Number(sp.day) || 1));
  const titles: { day: number; title: string }[] = trip.plan_style?.day_titles ?? [];
  const today = stops.filter((s) => s.day === day);
  let km = 0;
  today.forEach((s, i) => { if (i) km += distanceM(today[i - 1].lat, today[i - 1].lng, s.lat, s.lng) / 1000; });
  const owner = trip.owner_id === user.id;
  const stays: Stay[] = trip.plan_style?.stays ?? [];
  const eats: Record<string, Eat[]> = trip.plan_style?.eats ?? {};
  const tier: Tier | undefined = trip.plan_style?.stay_tier;

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 wide:max-w-6xl wide:pt-4">
      <BackHeader href="/trips?tab=planned" title={`${trip.name}, ${days} day${days === 1 ? "" : "s"}`} subtitle={formatRange(trip.start_date, trip.end_date)}
        right={<Link href={`/plan/${id}/setup`} className="min-h-[40px] content-center text-[12.5px] font-bold text-coral">Edit</Link>} />

      {!built ? (
        <Empty title="No itinerary yet" action={<Link href={`/plan/${id}/places`} className={buttonClass("primary")}>Add must-visit places</Link>}>
          Add the places you&apos;d hate to miss, then I&apos;ll build the days around them.
        </Empty>
      ) : (
        <div className="grid px-6 [grid-template-areas:'top'_'map'_'bottom'] wide:grid-cols-[minmax(0,1fr)_420px] wide:gap-x-8 wide:px-10 wide:[grid-template-areas:'map_top'_'map_bottom'] wide:[grid-template-rows:auto_1fr]">
          <div className="[grid-area:top]">
          <nav aria-label="Days" className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {Array.from({ length: days }, (_, i) => (
              <Link key={i} href={`/plan/${id}?day=${i + 1}`} aria-current={day === i + 1 ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[12px] ${day === i + 1 ? "bg-deep font-bold text-white" : "border border-line bg-card text-body"}`}>
                Day {i + 1}
              </Link>
            ))}
          </nav>
          {titles.find((t) => t.day === day) && <p className="mt-3 text-[15px] font-bold text-ink">{titles.find((t) => t.day === day)!.title}</p>}

          {stays.length > 0 && (
            <details open={day === 1} className="group mt-3 rounded-[16px] bg-card p-4 shadow-card">
              <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-3">
                <Ato size={40} />
                <span className="flex-1">
                  <span className="block text-[10px] font-bold text-coral">WHERE TO STAY</span>
                  <span className="block text-[12.5px] font-bold text-ink">{stays.length} {tier ? `${TIER_LABEL[tier]} ` : ""}pick{stays.length === 1 ? "" : "s"} close to your plan</span>
                </span>
                <span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span>
              </summary>
              <ul className="mt-3 space-y-3">
                {stays.map((h) => (
                  <li key={h.ref} className="rounded-[12px] bg-surface px-3 py-2.5">
                    <a href={mapsLink(h.lat, h.lng)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-ink underline-offset-2 hover:underline">{h.name}</a>
                    <p className="text-[11px] text-muted">
                      {h.stars ? `${h.stars}★ ` : ""}{KIND_LABEL[h.kind] ?? "Stay"}, about {h.km} km from your stops, closest to day {h.nearDay}
                    </p>
                    {h.reason && <p className="mt-1 text-[12px] leading-snug text-body">{h.reason}</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10.5px] text-muted">Places from OpenStreetMap. Check prices and rooms before you book.</p>
            </details>
          )}

          {day === 1 && (trip.plan_style?.learned ?? []).length > 0 && (
            <div className="mt-3 flex items-start gap-3 rounded-[16px] border-l-4 border-coral bg-card p-4 shadow-card">
              <Ato size={48} />
              <div>
                <p className="text-[10px] font-bold text-coral">WHAT I LEARNED FROM YOUR LAST TRIPS</p>
                <ul className="mt-1 space-y-1 text-[12px] leading-snug text-body">
                  {(trip.plan_style.learned as string[]).map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            </div>
          )}

          </div>
          <div className="[grid-area:map]">
          <MemoryMap pins={today.map((s, i) => ({ id: s.id, lat: s.lat, lng: s.lng, count: i + 1, label: s.name }))} zoom={12} className="mt-3 h-[200px] rounded-[18px] wide:sticky wide:top-6 wide:mt-0 wide:h-[calc(100dvh-140px)]" />
          </div>
          <div className="[grid-area:bottom]">

          <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
            {today.map((s) => (
              <li key={s.id} className="relative">
                <span className={`absolute -left-[23px] top-3 h-3 w-3 rounded-full border-2 border-white ${s.source === "user" ? "bg-coral" : "bg-aqua"}`} />
                <p className="mb-1 text-[10px] font-bold text-muted">{s.start_time?.slice(0, 5)}</p>
                <div className="rounded-[14px] bg-card px-4 py-3 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <a href={mapsLink(s.lat, s.lng)} target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-bold text-ink underline-offset-2 hover:underline">{s.name}</a>
                    {s.source === "user" && <span className="shrink-0 rounded-full bg-[#e8623f24] px-2 py-0.5 text-[9.5px] font-bold text-coral-dark">yours</span>}
                  </div>
                  <p className="text-[11px] text-muted">
                    {CATEGORY_LABEL[(s.category ?? "other") as Category]}, about {s.duration_min} min{s.reason ? `. ${s.reason}` : ""}
                  </p>
                  {eats[s.id]?.length ? (
                    <div className="mt-2 border-t border-line pt-2">
                      <p className="text-[10px] font-bold text-muted">EAT NEARBY</p>
                      <ul className="mt-1 space-y-1">
                        {eats[s.id].map((e) => (
                          <li key={e.name} className="text-[11.5px] leading-snug">
                            <a href={mapsLink(e.lat, e.lng)} target="_blank" rel="noopener noreferrer" className="font-bold text-body underline-offset-2 hover:underline">{e.name}</a>
                            <span className="text-muted">{e.cuisine ? `, ${e.cuisine}` : ""}, {e.walkMin} min walk</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {today.length === 0 && <p className="mt-4 text-[12px] text-muted">A free day. Add a must-visit and pin it here if you want one.</p>}

          <div className="mt-5 flex items-center justify-between rounded-[14px] bg-surface px-4 py-3">
            <span className="text-[12px] text-body">Day total<span className="block text-[10.5px] text-muted">{today.length} stops, {km.toFixed(1)} km between them</span></span>
            {owner && <Link href={`/plan/${id}/build`} className="text-[11.5px] font-bold text-deep">Rebuild</Link>}
          </div>

          <Link href={`/trips/${id}/intel`} className="mt-4 flex items-center justify-between rounded-[14px] bg-card px-4 py-3 shadow-card">
            <span className="text-[12px] text-body"><strong className="block text-ink">Trip intel</strong>Entry rules and travel news before you go</span>
            <span className="text-coral">›</span>
          </Link>
          <Link href={`/trips/${id}/money`} className="mt-2 flex items-center justify-between rounded-[14px] bg-card px-4 py-3 shadow-card">
            <span className="text-[12px] text-body"><strong className="block text-ink">Money</strong>{trip.budget ? `Budget RM ${Number(trip.budget).toLocaleString("en-MY")} · ` : ""}collect the kitty before you go</span>
            <span className="text-coral">›</span>
          </Link>

          {owner ? (
            <form action={startTrip.bind(null, id)} className="mt-5 flex items-center gap-3">
              <Ato size={52} />
              <button className={buttonClass("primary")}>Start trip</button>
            </form>
          ) : <p className="mt-5 text-center text-[12px] text-muted">The trip leader starts the trip.</p>}
          </div>
        </div>
      )}
    </main>
  );
}
