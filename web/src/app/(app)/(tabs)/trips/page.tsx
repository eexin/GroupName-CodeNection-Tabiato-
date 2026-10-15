import Link from "next/link";
import { Ato } from "@/components/ato";
import { TripCard } from "@/features/trips/components/trip-rows";
import { Empty, Fab } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getMyTrips } from "@/features/trips/data";

/** 07 Trips and 07b Planned — two tabs of one list. */
export default async function TripsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const planned = tab === "planned";
  const { supabase, user } = await requireUser();
  const [all, { data: me }] = await Promise.all([
    getMyTrips(supabase, user.id),
    supabase.from("profiles").select("settings").eq("id", user.id).single(),
  ]);
  const insightsOn = me?.settings?.ato_insights !== false;
  const list = all.filter((t) => (planned ? t.trip.status === "planned" : t.trip.status !== "planned"));

  return (
    <main className="px-6 pt-[max(1.5rem,env(safe-area-inset-top))] wide:mx-auto wide:max-w-5xl wide:px-10 wide:pt-8">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[24px] font-bold text-ink">Trips</h1>
        <Link href="/search" aria-label="Search your memories" className="grid h-10 w-10 place-items-center">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <circle cx="8" cy="8" r="7" fill="none" stroke="#12312F" strokeWidth={1.8} />
            <path d="M13 13 19 19" stroke="#12312F" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      <nav aria-label="Trip type" className="mt-5 grid grid-cols-2 rounded-[14px] bg-surface p-0.5">
        {[["Memory trips", "/trips", !planned], ["Planned", "/trips?tab=planned", planned]].map(([label, href, on]) => (
          <Link key={String(label)} href={String(href)} aria-current={on ? "page" : undefined}
            className={`rounded-[12px] py-2 text-center text-[12.5px] ${on ? "bg-card font-bold text-ink shadow-sm" : "font-medium text-muted"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {!planned && insightsOn && (
        <Link href="/insights" className="mt-5 flex items-center gap-3 rounded-[18px] bg-gradient-to-br from-[#12666e] to-deeper p-4 shadow-card">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold text-white">Your travel insights</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-[#8fbdb8]">Your pace, spending and what you rate highest</span>
          </span>
          <Ato size={58} />
        </Link>
      )}

      {planned && (
        <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-card p-4 shadow-card">
          <Ato size={52} />
          <p className="text-[11.5px] leading-snug text-body">
            <span className="block font-bold text-ink">A plan becomes a memory trip</span>
            When you press Start trip, I begin recording photos against the plan.
          </p>
        </div>
      )}
      {planned && list.length > 0 && <h2 className="mt-5 text-[11px] font-bold text-muted">UPCOMING</h2>}
      {list.length ? (
        <ul className="mt-5 space-y-4 pb-8 wide:grid wide:grid-cols-2 wide:gap-5 wide:space-y-0 xl:grid-cols-3">{list.map((t) => <li key={t.trip.id}><TripCard s={t} /></li>)}</ul>
      ) : planned ? (
        <Empty title="Nothing planned yet">Plan your next trip with Ato — add the places you&apos;d hate to miss and it builds the days around them.</Empty>
      ) : (
        <Empty title="No trips yet">Create a memory trip, then add photos while you travel or when you get home.</Empty>
      )}

      <Fab href={planned ? "/plan" : "/trips/new"} label={planned ? "Plan a trip" : "Create memory trip"} />
    </main>
  );
}
