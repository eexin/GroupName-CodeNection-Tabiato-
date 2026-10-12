import Link from "next/link";
import { Ato } from "@/components/ato";
import { Avatar, Cover, Empty } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { toggleLike, toggleSave } from "@/features/community/actions";
import { NearbyChip } from "@/features/community/components/nearby";
import { getCommunity, type Filter } from "@/features/community/data";
import { money } from "@/lib/currency";

const Heart = ({ on }: { on: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2.2 0 3.6 1.3 4.4 2.6.8-1.3 2.2-2.6 4.4-2.6 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20Z" fill={on ? "#b8402a" : "none"} stroke={on ? "#b8402a" : "#536b68"} strokeWidth={1.8} /></svg>
);
const Bookmark = ({ on }: { on: boolean }) => (
  <svg width="18" height="20" viewBox="0 0 18 22" aria-hidden><path d="M2 2h14v18l-7-5-7 5Z" fill={on ? "#0e4c55" : "none"} stroke={on ? "#0e4c55" : "#536b68"} strokeWidth={1.8} strokeLinejoin="round" /></svg>
);

/** 23 Community — real trips with the real cost. */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ filter?: string; near?: string }> }) {
  const sp = await searchParams;
  const filter = (["foryou", "nearby", "budget", "saved"].includes(sp.filter ?? "") ? sp.filter : "foryou") as Filter;
  const [lat, lng] = (sp.near ?? "").split(",").map(Number);
  const near = Number.isFinite(lat) && Number.isFinite(lng) && sp.near ? { lat, lng } : null;
  const { supabase, user } = await requireUser();
  const cards = filter === "nearby" && !near ? [] : await getCommunity(supabase, user.id, filter, near);
  const chip = (f: Filter, label: string) => (
    <Link href={`/community?filter=${f}`} aria-current={filter === f ? "page" : undefined}
      className={`grid min-h-[40px] place-items-center rounded-full px-4 text-[12.5px] ${filter === f ? "bg-coral font-bold text-white" : "border border-line bg-card text-body"}`}>{label}</Link>
  );

  return (
    <main className="px-6 pt-[max(1.5rem,env(safe-area-inset-top))] lg:mx-auto lg:max-w-5xl lg:px-10 lg:pt-8">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[24px] font-bold text-ink">Community</h1>
        <Ato size={52} />
      </header>
      <nav aria-label="Filter" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {chip("foryou", "For you")}
        <NearbyChip active={filter === "nearby"} />
        {chip("budget", "Budget")}
        {chip("saved", "Saved")}
      </nav>

      {filter === "nearby" && !near ? (
        <Empty title="Trips near you">Tap Nearby and allow location to see trips closest to where you are.</Empty>
      ) : cards.length === 0 ? (
        <Empty title={filter === "saved" ? "Nothing saved yet" : "No public trips yet"}>
          {filter === "saved" ? "Tap the bookmark on any trip to keep it here." : filter === "budget" ? "No public trips have shared their spending yet." : "When someone shares a finished trip, it appears here with its real route and cost."}
        </Empty>
      ) : (
        <ul className="mt-5 space-y-5 pb-8 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 xl:grid-cols-3">
          {cards.map((c) => (
            <li key={c.trip.id} className="overflow-hidden rounded-[22px] bg-card shadow-card">
              <Link href={`/community/${c.trip.id}`} className="block">
                <span className="relative block">
                  <Cover url={c.coverUrl} seed={c.trip.id} className="h-40 w-full" />
                  <span className="absolute left-4 top-3.5 rounded-full bg-white/95 px-3 py-1 text-[9.5px] font-bold text-ink">PUBLIC</span>
                </span>
                <span className="flex items-center gap-2.5 px-4 pt-3">
                  <Avatar p={c.author} size={32} />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-bold text-ink">{c.author.name}</span>
                    <span className="block truncate text-[10.5px] text-muted">{c.route}</span>
                  </span>
                </span>
                <span className="block px-4 pt-2 text-[15px] font-bold text-ink">
                  {c.days} days in {c.trip.destination?.split(",")[0] ?? c.trip.name}{c.spend ? ` on ${money(Math.round(c.spend))}` : ""}
                </span>
              </Link>
              <div className="flex items-center gap-1 px-4 pb-3 pt-1">
                <Link href={`/community/${c.trip.id}`} className="flex-1 text-[11px] text-muted">Full itinerary, spend and photos →</Link>
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
