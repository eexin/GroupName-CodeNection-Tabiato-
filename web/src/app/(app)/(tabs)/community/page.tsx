import Link from "next/link";
import { Ato } from "@/components/ato";
import { Avatar, Cover, Empty } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { toggleLike, toggleSave } from "@/features/community/actions";
import { NearbyChip } from "@/features/community/components/nearby";
import { getActivity, getCommunity, type Filter } from "@/features/community/data";
import { trending } from "@/features/community/trending";
import { money } from "@/lib/currency";
import { timeAgo } from "@/lib/time";
import { shortName } from "@/lib/people";
import { PersonLink } from "@/components/ui";

const Heart = ({ on }: { on: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2.2 0 3.6 1.3 4.4 2.6.8-1.3 2.2-2.6 4.4-2.6 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20Z" fill={on ? "#b8402a" : "none"} stroke={on ? "#b8402a" : "#536b68"} strokeWidth={1.8} /></svg>
);
const Bookmark = ({ on }: { on: boolean }) => (
  <svg width="18" height="20" viewBox="0 0 18 22" aria-hidden><path d="M2 2h14v18l-7-5-7 5Z" fill={on ? "#0e4c55" : "none"} stroke={on ? "#0e4c55" : "#536b68"} strokeWidth={1.8} strokeLinejoin="round" /></svg>
);

/** 23 Community — real trips with the real cost. */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ filter?: string; near?: string; dest?: string }> }) {
  const sp = await searchParams;
  const filter = (["foryou", "nearby", "budget", "saved"].includes(sp.filter ?? "") ? sp.filter : "foryou") as Filter;
  const [lat, lng] = (sp.near ?? "").split(",").map(Number);
  const near = Number.isFinite(lat) && Number.isFinite(lng) && sp.near ? { lat, lng } : null;
  const { supabase, user } = await requireUser();
  const dest = filter === "foryou" ? sp.dest?.trim().slice(0, 60) || null : null;
  const [cards, activity] = await Promise.all([
    filter === "nearby" && !near ? Promise.resolve([]) : getCommunity(supabase, user.id, filter, near, dest),
    filter === "foryou" && !dest ? getActivity(supabase, user.id) : Promise.resolve([]),
  ]);
  // trending is worked out from the same public trips the feed shows
  const destinations = filter === "foryou" && !dest ? trending(cards) : [];
  const chip = (f: Filter, label: string) => (
    <Link href={`/community?filter=${f}`} aria-current={filter === f ? "page" : undefined}
      className={`grid min-h-[40px] shrink-0 place-items-center whitespace-nowrap rounded-full px-4 text-[12.5px] ${filter === f ? "bg-coral font-bold text-white" : "border border-line bg-card text-body"}`}>{label}</Link>
  );

  return (
    <main className="px-6 pt-[max(1.5rem,env(safe-area-inset-top))] wide:mx-auto wide:max-w-5xl wide:px-10 wide:pt-8">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[24px] font-bold text-ink">Community</h1>
        <Ato size={52} />
      </header>
      <nav aria-label="Filter" className="-mx-6 mt-4 flex gap-2 overflow-x-auto px-6 pb-1 wide:mx-0 wide:px-0 no-scrollbar">
        {chip("foryou", "For you")}
        <NearbyChip active={filter === "nearby"} />
        {chip("budget", "Budget")}
        {chip("saved", "Saved")}
      </nav>

      {destinations.length > 1 && (
        <section aria-labelledby="trending" className="mt-5">
          <h2 id="trending" className="text-[13px] font-bold text-ink">Trending destinations</h2>
          <ul className="no-scrollbar -mx-6 mt-2 flex gap-3 overflow-x-auto px-6 pb-1 wide:mx-0 wide:px-0">
            {destinations.map((d) => (
              <li key={d.name} className="shrink-0">
                <Link href={`/community?dest=${encodeURIComponent(d.name)}`} className="relative block h-[104px] w-[136px] overflow-hidden rounded-[18px] shadow-card">
                  <Cover url={d.coverUrl} seed={d.name} className="absolute inset-0 h-full w-full" />
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-deeper/85 via-deeper/20 to-transparent" />
                  <span className="absolute inset-x-3 bottom-2.5 text-white">
                    <span className="block truncate text-[14px] font-bold">{d.name}</span>
                    <span className="block text-[10.5px] text-[#d6ecea]">{d.trips} {d.trips === 1 ? "trip" : "trips"} · {d.likes} likes</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activity.length > 0 && (
        <section aria-labelledby="happening" className="mt-5 rounded-[20px] bg-card p-4 shadow-card">
          <h2 id="happening" className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <span aria-hidden className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral/60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-coral" /></span>
            Happening now
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {activity.map((a, i) => (
              <li key={i}>
                <div className="flex min-h-[48px] items-center gap-3 py-2">
                  <PersonLink id={a.who.id} label={`${a.who.name}'s profile`} className="shrink-0"><Avatar p={a.who} size={30} /></PersonLink>
                  <Link href={a.href} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="min-w-0 flex-1 text-[12px] leading-snug text-body"><strong className="text-ink">{shortName(a.who.name)}</strong> {a.text}</span>
                    <span className="shrink-0 text-[10.5px] text-muted">{timeAgo(a.at)}</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dest && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-ink">Trips in {dest} <span className="text-[12px] font-normal text-muted">· {cards.length}</span></h2>
          <Link href="/community" className="min-h-[40px] content-center text-[12px] font-bold text-coral">Show all</Link>
        </div>
      )}

      {filter === "nearby" && !near ? (
        <Empty title="Trips near you">Tap Nearby and allow location to see trips closest to where you are.</Empty>
      ) : cards.length === 0 ? (
        <Empty title={filter === "saved" ? "Nothing saved yet" : "No public trips yet"}>
          {filter === "saved" ? "Tap the bookmark on any trip to keep it here." : filter === "budget" ? "No public trips have shared their spending yet." : "When someone shares a finished trip, it appears here with its real route and cost."}
        </Empty>
      ) : (
        <ul className="mt-5 space-y-5 pb-8 wide:grid wide:grid-cols-2 wide:gap-6 wide:space-y-0 xl:grid-cols-3">
          {cards.map((c) => (
            <li key={c.trip.id} className="overflow-hidden rounded-[22px] bg-card shadow-card">
              <Link href={`/community/${c.trip.id}`} className="block">
                <span className="relative block">
                  <Cover url={c.coverUrl} seed={c.trip.id} className="h-40 w-full" />
                  <span className="absolute left-4 top-3.5 rounded-full bg-white/95 px-3 py-1 text-[9.5px] font-bold text-ink">PUBLIC</span>
                </span>
              </Link>
              <PersonLink id={c.author.id} className="flex items-center gap-2.5 px-4 pt-3">
                <Avatar p={c.author} size={32} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-ink">{c.author.name} <span className="font-normal text-muted">· {timeAgo(c.trip.created_at)}</span></span>
                  <span className="block truncate text-[10.5px] text-muted">{c.route}</span>
                </span>
              </PersonLink>
              <Link href={`/community/${c.trip.id}`} className="block">
                <span className="block px-4 pt-2 text-[15px] font-bold text-ink">
                  {c.days} days in {c.trip.destination?.split(",")[0] ?? c.trip.name}{c.spend ? ` on ${money(Math.round(c.spend))}` : ""}
                </span>
              </Link>
              <div className="flex items-center gap-1 px-4 pb-3 pt-1">
                <Link href={`/community/${c.trip.id}`} className="flex-1 text-[11px] text-muted">Full itinerary, spend and photos&nbsp;→</Link>
                <form action={toggleSave.bind(null, c.trip.id, !c.saved)}>
                  <button aria-label={c.saved ? "Remove from saved" : "Save trip"} aria-pressed={c.saved} className="grid h-10 w-10 place-items-center"><Bookmark on={c.saved} /></button>
                </form>
                <form action={toggleLike.bind(null, c.trip.id, !c.liked)}>
                  <button aria-label={c.liked ? "Unlike" : "Like"} aria-pressed={c.liked} className="flex min-h-[40px] items-center gap-1 px-1.5 text-[12px] text-muted"><Heart on={c.liked} />{c.likes}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
