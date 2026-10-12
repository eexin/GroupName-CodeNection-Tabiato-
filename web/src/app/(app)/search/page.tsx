import Link from "next/link";
import { Ato } from "@/components/ato";
import { MemoryMap } from "@/components/memory-map";
import { AtoNote, BackHeader, Empty, Stars, buttonClass } from "@/components/ui";
import { RecentSearches, RememberSearch } from "@/features/search/components/recent";
import { requireUser } from "@/features/auth/guards";
import { searchMemories } from "@/features/search/data";
import { money } from "@/lib/currency";
import { formatDay } from "@/lib/time";

const TRY = ["Where did I eat the best ramen?", "What did I spend most on in Bali?", "Places I went with Max", "Everything I rated 5 stars"];

/** 12 Memory search, 13 results, 13b nothing found. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string }> }) {
  const { q = "", view } = await searchParams;
  const { supabase, user } = await requireUser();
  const term = q.trim().slice(0, 120);
  const r = term.length >= 2 ? await searchMemories(supabase, user.id, term) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href="/trips" title={r ? "Results" : "Search memories"} subtitle={r ? undefined : "Ask about anything you logged"}
        right={r && r.hits.length ? <Link href={`/search?q=${encodeURIComponent(term)}${view === "map" ? "" : "&view=map"}`} className="min-h-[40px] content-center text-[12px] font-bold text-coral">{view === "map" ? "List view" : "Map view"}</Link> : null} />
      <div className="px-6">
        <form role="search">
          <input name="q" defaultValue={q} placeholder="Ask anything about your trips" aria-label="Ask anything about your trips"
            className="h-[50px] w-full rounded-full border-[1.5px] border-coral bg-card px-5 text-[14px] placeholder:text-muted focus:outline-none" />
        </form>

        {!r ? (
          <>
            <div className="mt-4 flex items-center gap-3 text-[12px] text-muted"><Ato size={44} />Ask me in plain language.</div>
            <h2 className="mb-2 mt-6 text-[11px] font-bold text-ink">Try asking</h2>
            <ul className="space-y-2">
              {TRY.map((s) => (
                <li key={s}><Link href={`/search?q=${encodeURIComponent(s)}`} className="block rounded-[14px] bg-card px-4 py-3 text-[13px] text-body shadow-card">{s}</Link></li>
              ))}
            </ul>
            <RecentSearches />
          </>
        ) : r.hits.length ? (
          <>
            <div className="mt-5">
              <AtoNote label={`Ato found ${r.hits.length} memor${r.hits.length === 1 ? "y" : "ies"}`}>
                <strong className="block text-ink">Across {r.trips} trip{r.trips === 1 ? "" : "s"}.</strong>
                {r.line}
              </AtoNote>
            </div>
            <RememberSearch q={term} />
            {view === "map" && (
              <MemoryMap pins={r.hits.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, count: 1, label: h.name }))} zoom={4} className="mt-4 h-[320px] rounded-[18px]" />
            )}
            <ul className="mt-4 space-y-2.5">
              {r.hits.map((h) => (
                <li key={h.id}>
                  <Link href={`/places/${h.id}`} className="flex items-center gap-3 rounded-[16px] bg-card px-4 py-3 shadow-card">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-ink">{h.name}</span>
                      <span className="block truncate text-[11px] text-muted">{h.trip}{h.when ? ` · ${formatDay(h.when)}` : ""}{h.why ? ` · ${h.why}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <Stars value={h.rating} />
                      {h.spend > 0 && <span className="block text-[11px] text-muted">{money(Math.round(h.spend))}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <Empty title="Nothing logged yet">I couldn&apos;t find anything for &ldquo;{term}&rdquo;.</Empty>
            {r.suggestions.length > 0 && (
              <>
                <h2 className="mb-2 text-[11px] font-bold text-ink">Try instead</h2>
                <div className="flex flex-wrap gap-2">
                  {r.suggestions.map((s) => <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="min-h-[40px] content-center rounded-full bg-card px-4 text-[12.5px] text-body shadow-card">{s}</Link>)}
                </div>
              </>
            )}
            <div className="mt-6 space-y-2">
              <Link href="/add" className={buttonClass("primary")}>Add a memory instead</Link>
              <Link href="/search" className={buttonClass("quiet")}>Clear search</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
