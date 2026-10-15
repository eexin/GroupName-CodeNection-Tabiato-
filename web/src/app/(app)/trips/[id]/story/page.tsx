import { myr } from "@/lib/currency";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ato } from "@/components/ato";
import { MemoryMap } from "@/components/memory-map";
import { ShareButton } from "@/components/share-button";
import { BackHeader, Cover, Stars } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { computeFacts } from "@/features/memory-book/facts";
import { getTrip } from "@/features/trips/data";
import { formatRange } from "@/lib/time";
import { shortName } from "@/lib/people";

const COLORS = ["#b8402a", "#0e4c55", "#86570f", "#5c7fa8", "#536b68", "#7a6ba8"];

/** 25 Trip Story — the route, the highlights, the spend, and the way into the memory book. */
export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTrip(supabase, id, user.id);
  if (!t) notFound();
  const [{ data: photos }, { data: ratings }, { data: expenses }] = await Promise.all([
    supabase.from("photos").select("place_id, taken_at, uploaded_by").eq("trip_id", id),
    supabase.from("ratings").select("place_id, stars").eq("trip_id", id),
    supabase.from("expenses").select("amount, label, place_id, currency, amount_myr").eq("trip_id", id),
  ]);
  const facts = computeFacts({ places: t.places, photos: photos ?? [], ratings: ratings ?? [], expenses: (expenses ?? []).map((e) => ({ ...e, amount: myr(e) })), people: {} });
  const route = [...t.places].sort((a, b) => (a.first_seen_at ?? "").localeCompare(b.first_seen_at ?? ""));
  const highlights = [...t.places].filter((p) => p.photos > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.photos - a.photos).slice(0, 3);
  const others = t.members.filter((m) => m.status === "joined" && m.user_id !== user.id).map((m) => shortName(m.person.name));
  const month = t.trip.start_date ? new Date(t.trip.start_date + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : null;
  const sub = [facts.totals.days ? `${facts.totals.days} days` : null, month, others.length ? `with ${others.join(", ")}` : null].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 wide:max-w-5xl wide:pt-4">
      <BackHeader href={`/trips/${id}`} title="Trip story" subtitle={formatRange(t.trip.start_date, t.trip.end_date)}
        right={t.trip.is_public
          ? <ShareButton path={`/trips/${id}/story`} title={`${t.trip.name} — a Tabiato trip story`} className="bg-coral text-white" />
          : t.isOwner ? <Link href={`/trips/${id}/share`} className="text-[11.5px] font-bold text-coral">Make public to share</Link> : null} />
      {/* wide: the route on the left; highlights, spend and the book on the right */}
      <div className="space-y-5 px-6 wide:grid wide:grid-cols-2 wide:items-start wide:gap-x-8 wide:gap-y-5 wide:space-y-0 wide:[grid-template-areas:'title_title'_'route_high'_'route_spend'_'route_book'] wide:[grid-template-rows:auto_auto_auto_1fr]">
        <section className="wide:[grid-area:title]">
          <p className="text-[10.5px] font-bold text-coral">TRIP STORY</p>
          <h1 className="text-[26px] font-bold leading-tight text-ink">{t.trip.name}</h1>
          <p className="text-[12px] text-muted">{sub}</p>
        </section>

        <section className="wide:[grid-area:route]">
          <h2 className="mb-2 text-[11px] font-bold text-ink">The route</h2>
          <MemoryMap pins={route.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, count: i + 1, label: p.name }))} zoom={10} className="h-[200px] rounded-[18px] wide:h-[340px] land:h-[220px]" />
          <ol className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-body">
            {route.map((p, i) => <li key={p.id}>{i + 1}. {p.name}{i < route.length - 1 ? " →" : ""}</li>)}
          </ol>
        </section>

        {highlights.length > 0 && (
          <section className="wide:[grid-area:high]">
            <h2 className="mb-2 text-[11px] font-bold text-ink">Highlights</h2>
            <ul className="grid grid-cols-3 gap-2">
              {highlights.map((p) => (
                <li key={p.id}>
                  <Link href={`/places/${p.id}`} className="block">
                    <Cover url={t.thumbs[p.id] ?? null} seed={p.id} className="aspect-square w-full rounded-[14px]" />
                    <span className="mt-1 block truncate text-[11px] font-bold text-ink">{p.name}</span>
                    <Stars value={p.rating} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {facts.totals.spend > 0 && t.isMember && (
          <section className="rounded-[18px] bg-card p-5 shadow-card wide:[grid-area:spend]">
            <h2 className="text-[11px] font-bold text-ink">Spend</h2>
            <p className="mt-1 text-[24px] font-bold text-deep">RM {facts.totals.spend.toFixed(0)}</p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
              {facts.spendByCategory.map((s, i) => <span key={s.label} style={{ width: `${s.share * 100}%`, background: COLORS[i % COLORS.length] }} />)}
            </div>
            <p className="mt-2 text-[11px] text-body">{facts.spendByCategory.map((s) => `${s.label} ${Math.round(s.share * 100)}%`).join(" · ")}</p>
          </section>
        )}

        {t.isMember && (
          <Link href={`/trips/${id}/book`} className="flex items-center gap-3 rounded-[20px] wide:[grid-area:book] bg-gradient-to-br from-[#12666e] to-deeper p-5 shadow-card">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-white">{t.hasBook ? "Your memory book is ready" : "Write your memory book"}</span>
              <span className="mt-1 block text-[11px] text-[#bfe4e0]">
                {t.hasBook ? `Written by Ato from ${facts.totals.photos} photos and ${facts.totals.places} places` : `Ato reads your ${facts.totals.photos} photos and writes the story`}
              </span>
            </span>
            <Ato size={70} mood="happy" />
          </Link>
        )}
      </div>
    </main>
  );
}
