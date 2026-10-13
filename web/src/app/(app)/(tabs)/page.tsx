import Link from "next/link";
import { respondToInvite } from "@/features/trips/actions";
import { Ato } from "@/components/ato";
import { MapSheet } from "@/components/map-sheet";
import { TripRow } from "@/features/trips/components/trip-rows";
import { ButtonLink } from "@/components/ui";
import { requireProfile } from "@/features/auth/guards";
import { getInvites, getMyTrips } from "@/features/trips/data";
import { avatarFor } from "@/lib/people";

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** 05 Home — Memory Map, and 06 when there are no trips yet. */
export default async function HomePage() {
  const { supabase, user, profile } = await requireProfile();
  const [trips, invites] = await Promise.all([getMyTrips(supabase, user.id), getInvites(supabase, user.id)]);
  const memories = trips.reduce((n, t) => n + t.memories, 0);
  const pins = trips
    .filter((t) => t.center && t.trip.status !== "planned")
    .map((t) => ({ id: t.trip.id, lat: t.center!.lat, lng: t.center!.lng, count: t.memories, label: (t.trip.destination || t.trip.name).split(",")[0].trim() })); // "Seoul", not "Seoul, South Korea": short labels don't cover each other

  return (
    <main className="relative min-h-dvh">
      <MapSheet pins={pins} dim={!trips.length} header={(
          <header className="flex items-center gap-2 bg-gradient-to-b from-paper via-paper/85 to-transparent px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <Ato size={50} />
            <h1 className="flex items-baseline gap-2 text-[19px] font-bold text-ink">
              Tabiato <span className="text-[15px] font-normal text-coral">旅跡</span>
            </h1>
            <div className="ml-auto flex items-center gap-2.5">
              <Link href="/plan" aria-label="Plan a trip" className="grid h-[34px] w-[46px] place-items-center rounded-full bg-card shadow-card">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                  <path d="M2 14c4 0 4-10 8-10s4 6 6 6" fill="none" stroke="#0E4C55" strokeWidth={1.8} strokeLinecap="round" />
                  <circle cx="2" cy="14" r="2.2" fill="#E8623F" /><circle cx="16" cy="10" r="2.2" fill="#0E4C55" />
                </svg>
              </Link>
              <Link href="/profile" aria-label="Your profile" className="block h-[34px] w-[34px] overflow-hidden rounded-full bg-aqua-light shadow-card">
                <img src={avatarFor(profile.id, profile.avatar_url)} alt="" className="h-full w-full object-cover" />
              </Link>
            </div>
          </header>
      )}>
        {invites.map((inv) => (
          <div key={inv.trip.id} className="mt-7 rounded-[18px] border-l-4 border-sand bg-card p-4 shadow-card">
            <p className="text-[13px] text-ink"><strong>{inv.invitedBy}</strong> invited you to <strong>{inv.trip.name}</strong></p>
            <div className="mt-3 flex gap-2">
              <form action={respondToInvite.bind(null, inv.trip.id, true)} className="flex-1">
                <button className="h-10 w-full rounded-[12px] bg-coral text-[13px] font-bold text-white">Join trip</button>
              </form>
              <form action={respondToInvite.bind(null, inv.trip.id, false)} className="flex-1">
                <button className="h-10 w-full rounded-[12px] bg-surface text-[13px] font-bold text-muted">Decline</button>
              </form>
            </div>
          </div>
        ))}

        {trips.length ? (
          <>
            {/* the add button lives in the heading row, not floating, so it never covers a trip */}
            <div className="mb-3 mt-7 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="trips-heading" className="text-[16px] font-bold text-ink">Your memory trips</h2>
                <p className="text-[11.5px] text-muted">{count(trips.length, "trip")}, {count(memories, "memory", "memories")}</p>
              </div>
              <Link href="/add" aria-label="Add a memory"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral shadow-fab transition-transform active:scale-95 lg:hidden">
                <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden><path d="M11 4v14M4 11h14" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" /></svg>
              </Link>
            </div>
            <ul className="space-y-3">{trips.map((t) => <li key={t.trip.id}><TripRow s={t} /></li>)}</ul>
          </>
        ) : (
          <div className="flex flex-col items-center px-4 pt-10 text-center">
            <Ato size={100} mood="happy" />
            <h2 id="trips-heading" className="mt-3 text-[19px] font-bold text-ink">No memories yet</h2>
            <p className="mt-2 max-w-[280px] text-[12.5px] leading-relaxed text-muted">
              Start a memory trip and your photos will pin themselves to the places you visit.
            </p>
            <div className="mt-6 w-full max-w-[240px]"><ButtonLink href="/trips/new">Create memory trip</ButtonLink></div>
          </div>
        )}
      </MapSheet>

    </main>
  );
}
