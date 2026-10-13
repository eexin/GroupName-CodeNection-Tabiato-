import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { addStop, moveStop, pinStop, removeStop } from "@/features/planner/actions";
import { AtoNote, BackHeader, buttonClass } from "@/components/ui";
import { IconSubmit } from "@/components/submit";
import { requireUser } from "@/features/auth/guards";
import { CATEGORY_LABEL } from "@/lib/categories";
import { nearbyPois, placeFromLink, searchPlaces } from "@/features/planner/osm";

type Stop = { id: string; name: string; category: string | null; source: string; fixed_day: number | null; fixed_time: string | null };

async function Suggestions({ tripId, lat, lng, interests, taken }: { tripId: string; lat: number; lng: number; interests: string[]; taken: string[] }) {
  const { supabase } = await requireUser();
  const pois = await nearbyPois(supabase, lat, lng);
  const picks = pois
    .filter((p) => !taken.includes(p.name.toLowerCase()))
    .sort((a, b) => Number(interests.includes(b.category)) - Number(interests.includes(a.category)) || Number(b.notable) - Number(a.notable))
    .slice(0, 5);
  // OpenStreetMap's free Overpass server is often busy; we give up on it rather than hold the page
  if (!picks.length) return <p className="text-[11.5px] text-muted">Nothing came back from OpenStreetMap just now. Search above to add places yourself, or try again in a few minutes.</p>;
  return (
    <ul className="space-y-2">
      {picks.map((p) => (
        <li key={p.ref} className="flex items-center gap-3 rounded-[14px] border border-line bg-card px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-ink">{p.name}</span>
            <span className="block text-[10.5px] text-muted">{CATEGORY_LABEL[p.category]}{interests.includes(p.category) ? " — one of your interests" : ""}</span>
          </span>
          <form action={async () => { "use server"; await addStop(tripId, { name: p.name, lat: p.lat, lng: p.lng, category: p.category, ref: p.ref }); }}>
            <IconSubmit label={`Add ${p.name}`} className="grid h-10 w-10 place-items-center rounded-full bg-surface text-[18px] font-bold text-deep">+</IconSubmit>
          </form>
        </li>
      ))}
    </ul>
  );
}

/** 35 Your must-visit places. Added first; the planner fits everything else around them. */
export default async function PlacesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ id }, { q = "" }] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  if (trip.status !== "planned") redirect(`/trips/${id}`);
  const [{ data: stopRows }, { count: members }] = await Promise.all([
    supabase.from("plan_stops").select("*").eq("trip_id", id).eq("source", "user").order("priority", { nullsFirst: false }).order("created_at"),
    supabase.from("trip_members").select("*", { count: "exact", head: true }).eq("trip_id", id).eq("status", "joined"),
  ]);
  const stops = (stopRows ?? []) as Stop[];
  const days = Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1);
  const interests: string[] = trip.plan_style?.interests ?? [];
  const term = q.trim();
  const linked = /^https?:\/\//i.test(term) ? await placeFromLink(term) : null;
  const hits = linked ? [linked] : term.length >= 2 && !/^https?:\/\//i.test(term) ? await searchPlaces(term, { lat: trip.dest_lat, lng: trip.dest_lng }) : [];
  const next = (members ?? 1) > 1 ? `/plan/${id}/board` : `/plan/${id}/build`;

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href={`/plan/${id}/setup`} title="Your must-visit places" subtitle="Add them first — Ato plans the days around them" />
      <div className="px-6">
        <form role="search" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search a place, or paste a link" aria-label="Search a place"
            className="h-[48px] flex-1 rounded-full border-[1.5px] border-coral bg-card px-5 text-[13.5px] focus:outline-none focus:ring-[3px] focus:ring-coral/30" />
          <button className="h-[48px] rounded-full bg-coral px-5 text-[13px] font-bold text-white">Search</button>
        </form>

        {hits.length > 0 && (
          <ul className="mt-3 space-y-2">
            {hits.map((h) => (
              <li key={h.ref} className="flex items-center gap-3 rounded-[14px] bg-card px-4 py-2.5 shadow-card">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{h.name}</span>
                  <span className="block truncate text-[10.5px] text-muted">{h.detail}</span>
                </span>
                <form action={async () => { "use server"; await addStop(id, { name: h.name, lat: h.lat, lng: h.lng, category: h.category, ref: h.ref }); }}>
                  <IconSubmit label={`Add ${h.name}`} className="rounded-full bg-coral px-3 py-1.5 text-[11px] font-bold text-white">Add</IconSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
        {term.length >= 2 && !hits.length && <p className="mt-3 text-[12px] text-muted">{/^https?:\/\//i.test(term) ? "I couldn't read a place from that link. Paste a Google Maps link to a place, or search by name." : <>Nothing found for &ldquo;{term}&rdquo;. Try the place&apos;s full name.</>}</p>}

        <h2 className="mb-2 mt-6 flex justify-between text-[11px] font-bold text-ink">Your list <span className="font-normal text-muted">{stops.length} places · your first pick leads day 1</span></h2>
        {stops.length === 0 && <p className="text-[12px] text-muted">Search for the places you&apos;d hate to miss.</p>}
        <ol className="space-y-2.5">
          {stops.map((s, i) => (
            <li key={s.id} className="rounded-[16px] bg-card p-3 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8623f24] text-[11px] font-bold text-coral">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-ink">{s.name}</span>
                  <span className={`block text-[10.5px] ${s.fixed_day || s.fixed_time ? "font-medium text-coral" : "text-muted"}`}>
                    {s.fixed_day || s.fixed_time
                      ? `Fixed${s.fixed_day ? `, day ${s.fixed_day}` : ""}${s.fixed_time ? ` at ${s.fixed_time.slice(0, 5)}` : ""}`
                      : "Any time"}
                  </span>
                </span>
                <div className="flex flex-col">
                  <form action={moveStop.bind(null, id, s.id, -1)}>
                    <IconSubmit label={`Move ${s.name} up`} disabled={i === 0} className="grid h-8 w-9 place-items-center text-[14px] text-deep">▲</IconSubmit>
                  </form>
                  <form action={moveStop.bind(null, id, s.id, 1)}>
                    <IconSubmit label={`Move ${s.name} down`} disabled={i === stops.length - 1} className="grid h-8 w-9 place-items-center text-[14px] text-deep">▼</IconSubmit>
                  </form>
                </div>
                <form action={removeStop.bind(null, id, s.id)}>
                  <IconSubmit label={`Remove ${s.name}`} className="grid h-10 w-10 place-items-center rounded-full text-[18px] leading-none text-muted">×</IconSubmit>
                </form>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-bold text-deep">Set a day or time</summary>
                <form action={pinStop.bind(null, id, s.id)} className="mt-2 flex gap-2">
                  <select name="day" defaultValue={s.fixed_day ?? ""} aria-label="Day" className="h-9 rounded-[10px] border border-line bg-card px-2 text-[12px]">
                    <option value="">Any day</option>
                    {Array.from({ length: days }, (_, d) => <option key={d} value={d + 1}>Day {d + 1}</option>)}
                  </select>
                  <input type="time" name="time" defaultValue={s.fixed_time?.slice(0, 5) ?? ""} aria-label="Time" className="h-9 rounded-[10px] border border-line px-2 text-[12px]" />
                  <IconSubmit label={`Save the day and time for ${s.name}`} className="h-9 flex-1 rounded-[10px] bg-surface text-[11.5px] font-bold text-deep">Save</IconSubmit>
                </form>
              </details>
            </li>
          ))}
        </ol>

        <h2 className="mb-1 mt-6 text-[11px] font-bold text-ink">Ato suggests</h2>
        <p className="mb-2 text-[11px] text-muted">From your Travel DNA — tap ＋ to add. Real places near {trip.name}.</p>
        <Suspense fallback={<p className="text-[11.5px] text-muted">Looking around {trip.name}…</p>}>
          <Suggestions tripId={id} lat={trip.dest_lat} lng={trip.dest_lng} interests={interests} taken={stops.map((s) => s.name.toLowerCase())} />
        </Suspense>

        <div className="mt-6"><AtoNote label={`I'll fit the rest around ${stops.length ? `these ${stops.length}` : "your picks"}`}>Nothing you added gets moved or dropped.</AtoNote></div>
        <div className="mt-4 space-y-2">
          {trip.owner_id === user.id && <Link href={`/trips/${id}/invite`} className={buttonClass("quiet")}>Invite friends to plan</Link>}
          {trip.owner_id === user.id || (members ?? 1) > 1
            ? <Link href={next} className={buttonClass("primary")}>{(members ?? 1) > 1 ? "See group preferences" : "Build my itinerary"}</Link>
            : null}
        </div>
      </div>
    </main>
  );
}
