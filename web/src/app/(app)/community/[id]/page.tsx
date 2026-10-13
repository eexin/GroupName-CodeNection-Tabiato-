import Link from "next/link";
import { notFound } from "next/navigation";
import { Ato } from "@/components/ato";
import { MemoryMap } from "@/components/memory-map";
import { Avatar, Cover, Stars } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { startFromTrip, toggleFollow, toggleLike, toggleSave } from "@/features/community/actions";
import { sharedSpend } from "@/features/community/data";
import { getTrip } from "@/features/trips/data";
import { CATEGORY_LABEL, type Category } from "@/lib/categories";
import { money, myr } from "@/lib/currency";
import { person } from "@/lib/people";

const COLORS = ["#b8402a", "#0e4c55", "#86570f", "#5c7fa8", "#536b68", "#7a6ba8"];
const days = (s: string | null, e: string | null) => (s && e ? Math.round((Date.parse(e) - Date.parse(s)) / 86400000) + 1 : 1);

/** 23b A public trip — route, highlights, real cost, how it compares to yours, and "use as a starting point". */
export default async function PublicTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTrip(supabase, id, user.id);
  if (!t || (!t.trip.is_public && !t.isMember)) notFound();
  const authorId = t.trip.owner_id;
  const [{ data: author }, { count: authorTrips }, { count: followers }, { data: iFollow }, { count: likes }, { data: myLike }, { data: mySave }, spend] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url").eq("id", authorId).single(),
    supabase.from("trips").select("id", { count: "exact", head: true }).eq("owner_id", authorId).eq("is_public", true),
    supabase.from("follows").select("follower", { count: "exact", head: true }).eq("followee", authorId),
    supabase.from("follows").select("follower").eq("follower", user.id).eq("followee", authorId).maybeSingle(),
    supabase.from("likes").select("user_id", { count: "exact", head: true }).eq("trip_id", id),
    supabase.from("likes").select("user_id").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("saves").select("user_id").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
    sharedSpend(supabase, id),
  ]);
  const a = person(authorId, author?.display_name, author?.avatar_url);
  const len = days(t.trip.start_date, t.trip.end_date);
  const route = [...t.places].sort((x, y) => (x.first_seen_at ?? "").localeCompare(y.first_seen_at ?? ""));
  const highlights = t.places.filter((p) => p.photos > 0).sort((x, y) => (y.rating ?? 0) - (x.rating ?? 0)).slice(0, 3);
  const month = t.trip.start_date ? new Date(t.trip.start_date + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : "";

  // Ato compares it with your most recent trip that has spending
  let compare: string | null = null;
  if (spend && user.id !== authorId) {
    const { data: rows } = await supabase.from("trip_members").select("trip_id").eq("user_id", user.id).eq("status", "joined");
    const { data: mine } = await supabase.from("trips").select("id, name, start_date, end_date").in("id", (rows ?? []).map((r) => r.trip_id)).eq("status", "finished").order("start_date", { ascending: false }).limit(5);
    for (const m of mine ?? []) {
      const { data: ex } = await supabase.from("expenses").select("amount, currency, amount_myr").eq("trip_id", m.id);
      const total = (ex ?? []).reduce((s, e) => s + myr(e), 0);
      if (!total) continue;
      const mine_d = days(m.start_date, m.end_date);
      const diff = (spend.total / len) / (total / mine_d) - 1;
      const dd = len - mine_d;
      compare = `This is ${Math.abs(Math.round(diff * 100))}% ${diff < 0 ? "cheaper" : "more expensive"} per day than your ${m.name} trip${dd ? `, with ${Math.abs(dd)} ${dd > 0 ? "more" : "fewer"} day${Math.abs(dd) === 1 ? "" : "s"}` : ""}.`;
      break;
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-28">
      <section className="relative">
        <Cover url={t.thumbs[highlights[0]?.id] ?? null} seed={id} className="h-56 w-full" />
        <div className="absolute inset-x-0 top-0 flex justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <Link href="/community" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[16px] font-bold text-ink">‹</Link>
          <span className="h-fit rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold text-ink">PUBLIC</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-6 pb-4 pt-10 text-white">
          <h1 className="text-[24px] font-bold leading-tight">{len} days in {t.trip.destination?.split(",")[0] ?? t.trip.name}</h1>
          <p className="text-[12px] text-white/85">{route.length > 1 ? `${route[0].name} → ${route[route.length - 1].name} · ` : ""}{month}</p>
        </div>
      </section>

      <div className="space-y-5 px-6 pt-5">
        <section className="flex items-center gap-3 rounded-[18px] bg-card p-4 shadow-card">
          <Avatar p={a} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-ink">{a.name}</p>
            <p className="text-[10.5px] text-muted">{authorTrips ?? 0} public trip{authorTrips === 1 ? "" : "s"} · {followers ?? 0} follower{followers === 1 ? "" : "s"}</p>
          </div>
          {user.id !== authorId && (
            <form action={toggleFollow.bind(null, authorId, !iFollow, id)}>
              <button aria-pressed={Boolean(iFollow)} className={`min-h-[40px] rounded-full px-4 text-[12px] font-bold ${iFollow ? "bg-surface text-deep" : "bg-coral text-white"}`}>{iFollow ? "Following" : "Follow"}</button>
            </form>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-[11px] font-bold text-ink">The route</h2>
          <MemoryMap pins={route.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, count: i + 1, label: p.name }))} zoom={9} className="h-[190px] rounded-[18px]" />
        </section>

        {highlights.length > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] font-bold text-ink">Highlights</h2>
            <ul className="grid grid-cols-3 gap-2">
              {highlights.map((p) => (
                <li key={p.id}>
                  <Cover url={t.thumbs[p.id] ?? null} seed={p.id} className="aspect-square w-full rounded-[14px]" />
                  <span className="mt-1 block truncate text-[11px] font-bold text-ink">{p.name}</span>
                  <Stars value={p.rating} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {spend && (
          <section className="rounded-[18px] bg-card p-5 shadow-card">
            <h2 className="text-[11px] font-bold text-ink">What it cost</h2>
            <p className="mt-1 text-[24px] font-bold text-deep">{money(Math.round(spend.total))} <span className="text-[12px] font-normal text-muted">for {len} days</span></p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
              {spend.rows.map((r, i) => <span key={r.category} style={{ width: `${r.share * 100}%`, background: COLORS[i % COLORS.length] }} />)}
            </div>
            <p className="mt-2 text-[11px] text-body">{spend.rows.map((r) => `${CATEGORY_LABEL[r.category as Category] ?? "Other"} ${Math.round(r.share * 100)}%`).join(" · ")}</p>
            <p className="mt-1 text-[10px] text-muted">Totals only — no receipts are shared.</p>
          </section>
        )}

        {compare && (
          <div className="flex items-center gap-3 rounded-[18px] border-l-4 border-coral bg-card p-4 shadow-card">
            <Ato size={52} />
            <div><p className="text-[10px] font-bold text-coral">ATO COMPARED IT</p><p className="mt-0.5 text-[12.5px] text-body">{compare}</p></div>
          </div>
        )}

        {user.id !== authorId && (
          <form action={startFromTrip.bind(null, id)}>
            <button className="h-[52px] w-full rounded-[15px] bg-coral text-[15px] font-bold text-white">Use this as a starting point</button>
            <p className="mt-2 text-center text-[11px] text-muted">Their {t.places.length} places become your must-visits in a new plan.</p>
          </form>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] lg:sticky lg:max-w-none items-center gap-2 border-t border-line bg-card px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <form action={toggleLike.bind(null, id, !myLike)}>
          <button aria-pressed={Boolean(myLike)} className="flex min-h-[44px] items-center gap-1.5 px-2 text-[13px] font-bold text-ink">
            <span className={myLike ? "text-coral" : "text-muted"}>{myLike ? "♥" : "♡"}</span>{likes ?? 0}
          </button>
        </form>
        <form action={toggleSave.bind(null, id, !mySave)}>
          <button aria-pressed={Boolean(mySave)} className="min-h-[44px] px-3 text-[13px] font-bold text-deep">{mySave ? "Saved" : "Save"}</button>
        </form>
        {user.id !== authorId && (
          <Link href={`/messages/${authorId}`} className="ml-auto flex min-h-[44px] items-center rounded-full bg-deep px-5 text-[13px] font-bold text-white">Message {a.name.split(" ")[0]}</Link>
        )}
      </div>
    </main>
  );
}
