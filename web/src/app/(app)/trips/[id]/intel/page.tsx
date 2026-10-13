import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AtoNote, BackHeader, Empty } from "@/components/ui";
import { aiJSON } from "@/lib/ai";
import { requireUser } from "@/features/auth/guards";
import { travelAdvice, travelNews } from "@/features/live/intel";
import { looksRelevant } from "@/features/live/news-filter";
import { money, myr } from "@/lib/currency";

export const maxDuration = 60;

const countryName = (code: string) => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
};

/** 34 Trip intel — official FCDO travel advice plus recent travel news, each tied back to this trip by Ato. */
const TABS = [["all", "All"], ["money", "Money"], ["entry", "Entry"], ["transit", "Transit"]] as const;
const TOPIC: Record<string, RegExp> = {
  money: /tax|currency|yen|ringgit|price|fee|refund|cost|cash|card|exchange|tourist levy/i,
  entry: /visa|entry|immigration|passport|border|arrival|customs/i,
  transit: /airport|flight|airline|train|rail|metro|subway|bus|ferry|strike|transport|road|closure/i,
};

export default async function IntelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "all";
  const { supabase } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  if (!trip.country_code) {
    return (
      <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4">
        <BackHeader href={`/trips/${id}`} title="Trip intel" />
        <Empty title="No destination yet">Give this trip a destination and I&apos;ll pull official travel advice and news for it.</Empty>
      </main>
    );
  }
  const country = countryName(trip.country_code);
  const [advice, news, { data: ex }] = await Promise.all([
    travelAdvice(country), travelNews(trip.country_code, country),
    supabase.from("expenses").select("amount, currency, amount_myr").eq("trip_id", id),
  ]);
  const spent = Math.round((ex ?? []).reduce((s, e) => s + myr(e), 0));

  const notes = (advice || news.length)
    ? await aiJSON(
        "intel_notes",
        `You are Ato, a helpful goldfish travel companion. Using ONLY the facts, write "advice_note": one sentence (under 30 words) on what in the official advice matters most for this trip.
Then judge every news item strictly. Keep it only if it could change THIS trip: entry or visa rules, strikes or transport disruption, airport or flight problems, weather or natural disasters, safety at the destination, tourist taxes or prices, or events and closures at the destination. For a kept item write "why" (under 18 words) tying it to the trip. For anything else — general politics, business, markets, wars far away, adverts, lifestyle — give "why": "". When unsure, give "".
Never invent rules or dates. Return JSON {"advice_note": string, "news": [{"i": number, "why": string}]}.`,
        JSON.stringify({
          trip: { destination: trip.destination ?? country, start: trip.start_date, end: trip.end_date, status: trip.status, spent_so_far_rm: spent || null },
          advice: advice ? { latest_change: advice.change, sections: advice.sections.map((s) => ({ title: s.title, text: s.text.slice(0, 400) })) } : null,
          news: news.map((n, i) => ({ i, title: n.title })),
        }),
        z.object({ advice_note: z.string().max(260), news: z.array(z.object({ i: z.number(), why: z.string().max(160) })).max(10) }),
      )
    : null;
  const why = new Map((notes?.news ?? []).map((n) => [n.i, n.why.trim()]));
  // Ato keeps the news that could change this trip; without Ato, code keeps headlines that name
  // the place and are about travel. Either way, unrelated world news never shows.
  const places = [country, ...(trip.destination ?? "").split(",").map((p: string) => p.trim())];
  const relevant = (n: { title: string }, i: number) => (notes ? Boolean(why.get(i)) : looksRelevant(n.title, places));
  const showSection = (title: string) => tab === "all" || (tab === "entry" && /entry/i.test(title)) || (tab === "money" && /money|insurance/i.test(title)) || (tab === "transit" && /safety|transport/i.test(title));
  const shownNews = news.map((n, i) => ({ n, i })).filter(({ n, i }) => relevant(n, i) && (tab === "all" || TOPIC[tab].test(n.title)));
  const finished = trip.status === "finished";

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href={`/trips/${id}`} title="Trip intel" subtitle={`${country} · official advice and recent news`} />
      <div className="space-y-4 px-6">
        <nav aria-label="Topics" className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {TABS.map(([k, label]) => (
            <Link key={k} href={`/trips/${id}/intel${k === "all" ? "" : `?tab=${k}`}`} aria-current={tab === k ? "page" : undefined}
              className={`grid min-h-[40px] shrink-0 place-items-center whitespace-nowrap rounded-full px-4 text-[12.5px] ${tab === k ? "bg-deep font-bold text-white" : "border border-line bg-card text-body"}`}>{label}</Link>
          ))}
        </nav>
        {finished && <p className="rounded-[14px] bg-surface px-4 py-3 text-[12.5px] text-body">This trip has ended. Intel stops when your trip ends — here&apos;s the last of it.</p>}
        {notes?.advice_note && <AtoNote label="Ato read it for you">{notes.advice_note}</AtoNote>}
        {spent > 0 && (tab === "all" || tab === "money") && (
          <p className="rounded-[14px] bg-surface px-4 py-3 text-[12.5px] text-body">
            You&apos;ve logged <strong className="text-ink">{money(spent)}</strong> of spending on this trip so far — handy for tax-free shopping limits and refunds.
          </p>
        )}

        {advice ? (
          <section className="rounded-[20px] bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-deep px-3 py-1 text-[10px] font-bold text-white">OFFICIAL ADVICE</span>
              {advice.updated && <span className="text-[10.5px] text-muted">Updated {new Date(advice.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
            </div>
            {advice.change && <p className="mt-3 text-[13px] font-bold text-ink">{advice.change}</p>}
            <div className="mt-3 space-y-2">
              {advice.sections.filter((s) => showSection(s.title)).map((s) => (
                <details key={s.title} className="rounded-[12px] bg-surface px-4 py-2.5">
                  <summary className="cursor-pointer text-[12px] font-bold text-deep">{s.title}</summary>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-body">{s.text}</p>
                </details>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              UK Foreign, Commonwealth &amp; Development Office advice, written for British nationals — check your own government&apos;s rules too.
              Contains public sector information licensed under the Open Government Licence v3.0.{" "}
              <a href={advice.url} target="_blank" rel="noreferrer" className="underline">Read in full</a>
            </p>
          </section>
        ) : <p className="rounded-[14px] bg-surface px-4 py-3 text-[12px] text-muted">Official advice for {country} isn&apos;t available right now.</p>}

        <section>
          <h2 className="mb-2 text-[11px] font-bold text-ink">Travel news</h2>
          {shownNews.length ? (
            <ul className="space-y-3">
              {shownNews.map(({ n, i }) => (
                <li key={n.link}>
                  <a href={n.link} target="_blank" rel="noreferrer" className="block rounded-[18px] bg-card p-4 shadow-card">
                    <span className="block text-[13.5px] font-bold leading-snug text-ink">{n.title}</span>
                    {why.get(i) && <span className="mt-1.5 block text-[11.5px] font-medium text-coral">{why.get(i)}</span>}
                    <span className="mt-2 block text-[10px] text-muted">{n.source}{n.published ? ` · ${n.published.slice(0, 10)}` : ""}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="text-[12px] text-muted">{news.length
              ? `Nothing in the news right now that changes your trip to ${country}. I checked ${news.length} recent ${news.length === 1 ? "story" : "stories"}.`
              : `No recent travel news for ${country}.`}</p>}
          <p className="mt-3 text-[10px] text-muted">News via NewsData.io, delayed up to 12 hours on the free plan. Intel stops when your trip ends.</p>
        </section>
      </div>
    </main>
  );
}
