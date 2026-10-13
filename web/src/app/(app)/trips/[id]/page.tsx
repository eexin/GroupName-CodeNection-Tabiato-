import Link from "next/link";
import { Suspense } from "react";
import { LivePanel } from "@/features/live/components/live-panel";
import { notFound, redirect } from "next/navigation";
import { Ato } from "@/components/ato";
import { LinkedMap } from "@/components/map-links";
import { AtoNote, Avatars, BackHeader, ButtonLink, Cover, Empty, Fab, Stars } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getTrip, type PlaceSummary } from "@/features/trips/data";
import { dayKey, formatDay, formatRange, formatTime } from "@/lib/time";

function PlaceRow({ p, thumb }: { p: PlaceSummary; thumb: string | null }) {
  return (
    <Link href={`/places/${p.id}`} className="flex items-center gap-3 rounded-[14px] bg-card p-2 shadow-card">
      <Cover url={thumb} seed={p.id} className="h-10 w-10 shrink-0 rounded-[10px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold text-ink">{p.name}</span>
        <span className="block text-[10.5px] text-muted">
          {p.photos} photo{p.photos === 1 ? "" : "s"}{p.spend ? `, RM ${p.spend.toFixed(0)}` : ""}
        </span>
      </span>
      <span className="pr-2"><Stars value={p.rating} /></span>
    </Link>
  );
}

/** 08 Trip Map View, 08b after the trip, 09 Timeline. */
export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; dismiss?: string; rescheduled?: string }> }) {
  const [{ id }, { view, dismiss, rescheduled }] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireUser();
  const t = await getTrip(supabase, id, user.id);
  if (!t) notFound();
  if (t.trip.status === "planned") redirect(`/plan/${id}`);
  if (!t.isMember && t.trip.is_public) redirect(`/community/${id}`);

  const timeline = view === "timeline";
  const finished = t.trip.status === "finished";
  const ongoing = t.trip.status === "ongoing";
  // planned trips redirect to the planner above, so here the trip is under way or over
  const canAdd = t.isMember && t.me?.role !== "viewer";
  const joined = t.members.filter((m) => m.status === "joined");
  const pins = t.places.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, count: p.photos, label: p.name }));

  const days = new Map<string, PlaceSummary[]>();
  for (const p of t.places) {
    const k = p.first_seen_at ? dayKey(p.first_seen_at) : "undated";
    days.set(k, [...(days.get(k) ?? []), p]);
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-28 lg:max-w-6xl lg:pt-4">
      <BackHeader
        href={t.isMember ? "/trips" : "/community"}
        title={t.trip.name}
        subtitle={`${formatRange(t.trip.start_date, t.trip.end_date)}${finished ? ", finished" : ""}, ${t.photoCount} memories`}
        right={t.isMember && (
          <Link href={`/trips/${id}/options`} aria-label="Trip options" className="grid h-9 w-9 place-items-center">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><g fill="#12312F"><circle cx="4" cy="10" r="1.9" /><circle cx="10" cy="10" r="1.9" /><circle cx="16" cy="10" r="1.9" /></g></svg>
          </Link>
        )}
      />

      {/* phones: top, map, bottom in one column · desktop: map pinned on the left, content on the right */}
      <div className="grid px-6 [grid-template-areas:'top'_'map'_'bottom'] lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-8 lg:px-10 lg:[grid-template-areas:'map_top'_'map_bottom'] lg:[grid-template-rows:auto_1fr]">
        <div className="[grid-area:top]">
        <nav aria-label="View" className="grid grid-cols-2 rounded-[14px] bg-surface p-0.5">
          {[["Map", `/trips/${id}`, !timeline], ["Timeline", `/trips/${id}?view=timeline`, timeline]].map(([label, href, on]) => (
            <Link key={String(label)} href={String(href)} aria-current={on ? "page" : undefined}
              className={`rounded-[12px] py-2 text-center text-[12.5px] ${on ? "bg-card font-bold text-ink shadow-sm" : "font-medium text-muted"}`}>
              {label}
            </Link>
          ))}
        </nav>

        {rescheduled && (
          <p role="status" className="mt-4 rounded-[14px] border-l-4 border-aqua bg-card px-4 py-3 text-[12.5px] text-ink shadow-card">
            Done — Day {rescheduled.split("-")[0]} and Day {rescheduled.split("-")[1]} are swapped. Outdoor stops now fall on the safer day.
          </p>
        )}
        {ongoing && t.isMember && (
          <Suspense fallback={<p className="mt-4 text-[11.5px] text-muted">Checking weather and alerts…</p>}>
            <LivePanel trip={t.trip} dismissed={dismiss === "rain"} />
          </Suspense>
        )}

        {finished && t.isMember && (
          <Link href={`/trips/${id}/story`} className="mt-4 flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-[#12666e] to-deeper p-5 shadow-card">
            <span className="min-w-0 flex-1">
              <span className="block text-[9.5px] font-bold text-sand">{t.hasBook ? "Ato finished writing" : "Ready when you are"}</span>
              <span className="mt-1 block text-[18px] font-bold text-white">Your trip story</span>
              <span className="mt-0.5 block text-[11px] text-[#8fbdb8]">From {t.photoCount} memories across {t.places.length} places</span>
              <span className="mt-3 inline-block rounded-full bg-coral px-4 py-2 text-[11.5px] font-bold text-white">
                {t.hasBook ? "Read the story" : "Write the story"}
              </span>
            </span>
            <Ato size={84} mood="happy" />
          </Link>
        )}

        </div>
        <div className="[grid-area:map]">
        {!timeline && (
          <LinkedMap pins={pins} base="/places" zoom={3} className="mt-4 h-[280px] rounded-[22px] lg:sticky lg:top-6 lg:mt-0 lg:h-[calc(100dvh-140px)]" />
        )}
        </div>
        <div className="[grid-area:bottom]">

        <Link href={t.isMember ? `/trips/${id}/members` : "#"}
          className="mt-4 flex items-center gap-3 rounded-[14px] bg-card px-4 py-2.5 shadow-card">
          <Avatars people={joined.map((m) => m.person)} />
          <span className="flex-1 text-[11.5px] font-medium text-body">{joined.length} {joined.length === 1 ? "person" : "people"} on this trip</span>
          {t.isMember && <span className="text-[11px] font-bold text-coral">Manage</span>}
        </Link>

        {t.isMember && t.unplaced.length > 0 && (
          <Link href={`/trips/${id}/place-photos`} className="mt-3 flex items-center gap-3 rounded-[14px] border-l-4 border-sand bg-card px-4 py-3 shadow-card">
            <span className="flex-1 text-[12px] text-ink">
              <strong>{t.unplaced.length} photo{t.unplaced.length === 1 ? "" : "s"} need a place.</strong> They had no location data, so I didn&apos;t guess.
            </span>
            <span className="text-[11px] font-bold text-coral">Place</span>
          </Link>
        )}

        {t.places.length === 0 ? (
          <Empty title="No places yet"
            action={canAdd ? <ButtonLink href={`/trips/${id}/upload`}>Add photos</ButtonLink> : undefined}>
            Add photos and I&apos;ll group them into the places you visited.
          </Empty>
        ) : timeline ? (
          <div className="mt-2">
            {t.observation && <div className="mt-4"><AtoNote>{t.observation}</AtoNote></div>}
            {[...days.entries()].map(([day, ps], i) => (
              <section key={day}>
                <h2 className="mb-2 mt-5 text-[10.5px] font-bold text-coral">
                  {day === "undated" ? "No date" : `Day ${i + 1}, ${formatDay(ps[0].first_seen_at!)}`}
                </h2>
                <ol className="space-y-3 border-l-2 border-line pl-4">
                  {ps.map((p) => (
                    <li key={p.id} className="relative">
                      <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-white bg-deep" />
                      {p.first_seen_at && <p className="mb-1 text-[10px] font-bold text-muted">{formatTime(p.first_seen_at)}</p>}
                      <PlaceRow p={p} thumb={t.thumbs[p.id] ?? null} />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-2 mt-5 flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold text-ink">Places on this trip</h2>
              <span className="text-[11px] text-muted">{t.places.length} places</span>
            </div>
            <ul className="space-y-2.5">{t.places.map((p) => <li key={p.id}><PlaceRow p={p} thumb={t.thumbs[p.id] ?? null} /></li>)}</ul>
          </>
        )}

        {/* after the trip: photos often arrive later, so adding stays one tap away, below the places */}
        {finished && canAdd && t.places.length > 0 && (
          <div className="mt-5"><ButtonLink href={`/trips/${id}/upload`}>Add photos</ButtonLink></div>
        )}

        {ongoing && t.isOwner && t.places.length > 0 && (
          <Link href={`/trips/${id}/end`} className="mt-6 block text-center text-[12.5px] font-bold text-coral-dark">End this trip</Link>
        )}
        </div>
      </div>

      {canAdd && ongoing && <Fab href={`/trips/${id}/upload`} label="Add photos" icon="camera" aboveNav={false} />}
    </main>
  );
}
