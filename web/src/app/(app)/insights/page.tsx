import { Ato } from "@/components/ato";
import { AtoNote, BackHeader, Empty } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getInsights } from "@/features/insights/data";

const COLORS = ["#E8623F", "#0E4C55", "#E8A23F", "#7FC9C2", "#5C7FA8", "#C99A3E"];

/** 14 Travel Insights — numbers from your records, one line from Ato. */
export default async function InsightsPage() {
  const { supabase, user } = await requireUser();
  const data = await getInsights(supabase, user.id);
  if (!data) {
    return (
      <main className="mx-auto min-h-dvh max-w-[430px] wide:max-w-2xl wide:pt-4">
        <BackHeader href="/trips" title="Your travel insights" />
        <Empty title="Nothing to read yet">Record a trip and rate a few places. I&apos;ll show you how you actually travel.</Empty>
      </main>
    );
  }
  const { facts, ratedCategories, favourites, line } = data;
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 wide:max-w-5xl wide:pt-4">
      <BackHeader href="/trips" title="Your travel insights" subtitle={`Across ${data.trips} trips, ${data.memories} memories`} />
      {/* wide: two newspaper-style columns, read top to bottom, left then right; no card is split */}
      <div className="space-y-6 px-6 wide:columns-2 wide:gap-8 wide:space-y-0 *:break-inside-avoid wide:*:mb-6">
        <section className="flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-[#12666e] to-deeper p-5 text-white shadow-card">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-aqua-light">Your travel type</p>
            <p className="mt-1 text-[22px] font-bold capitalize leading-tight">{facts.travelType}</p>
          </div>
          <Ato size={86} mood="happy" />
        </section>

        {facts.spendByCategory.length > 0 && (
          <section>
            <h2 className="mb-2 flex justify-between text-[11px] font-bold text-ink">Where your money goes <span className="font-normal text-muted">all time</span></h2>
            <div className="rounded-[18px] bg-card p-5 shadow-card">
              <p className="text-[24px] font-bold text-deep">RM {facts.totals.spend.toFixed(0)}</p>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
                {facts.spendByCategory.map((s, i) => <span key={s.label} style={{ width: `${s.share * 100}%`, background: COLORS[i % COLORS.length] }} />)}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {facts.spendByCategory.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-2 text-[11.5px] text-body">
                    <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {s.label}<span className="ml-auto font-bold text-ink">{Math.round(s.share * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {ratedCategories.length > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] font-bold text-ink">What you rate highest</h2>
            <ul className="space-y-3">
              {ratedCategories.map((c) => (
                <li key={c.label}>
                  <div className="flex justify-between text-[12px]"><span className="text-body">{c.label}</span><span className="font-bold text-sand-ink">{c.rating}★</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface"><div className="h-1.5 rounded-full bg-sand-ink" style={{ width: `${(c.rating / 5) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {favourites.length > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] font-bold text-ink">Places you keep going back to</h2>
            <p className="mb-2 text-[11px] text-muted">Ato uses these to weight your next itinerary.</p>
            <ul className="space-y-2">
              {favourites.map(([name, n]) => (
                <li key={name} className="flex justify-between rounded-[14px] bg-card px-4 py-3 text-[12.5px] shadow-card">
                  <span className="font-bold text-ink">{name}</span><span className="text-muted">{n} visits</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {facts.observations.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[11px] font-bold text-ink">Patterns</h2>
            {facts.observations.map((o) => <p key={o} className="rounded-[14px] bg-surface px-4 py-3 text-[12.5px] text-body">{o}</p>)}
          </section>
        )}

        {line && <AtoNote label="Ato suggests">{line}</AtoNote>}
      </div>
    </main>
  );
}
