import Link from "next/link";
import { notFound } from "next/navigation";
import { respondToFriend, sendFriendRequest } from "@/features/friends/actions";
import { toggleFollow } from "@/features/community/actions";
import { getProfileTrips } from "@/features/community/data";
import { LinkedMap } from "@/components/map-links";
import { Ato } from "@/components/ato";
import { Avatar, Cover } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { person, shortName } from "@/lib/people";
import { formatRange } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (n: number) => `RM ${Math.round(n).toLocaleString("en-MY")}`;

/**
 * A traveller's profile: tabiato…/u/<username> (the add-me link) or /u/<id> (every name and
 * avatar in the app links here). Shows the trips they let you see: public ones, and friends-only
 * ones when you are their friend. Notes and private trips never appear.
 */
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { supabase, user } = await requireUser();
  const key = decodeURIComponent(username).replace(/^@/, "").toLowerCase();
  const { data: p } = await supabase.from("profiles").select("id, display_name, avatar_url, username")
    .eq(UUID.test(key) ? "id" : "username", key).maybeSingle();
  if (!p) notFound();
  const me = p.id === user.id;
  const pp = person(p.id, p.display_name, p.avatar_url);

  const [cards, { data: rel }, { count: followers }, { count: following }, { data: iFollow }] = await Promise.all([
    getProfileTrips(supabase, user.id, p.id),
    supabase.from("friendships").select("requester, addressee, status")
      .or(`and(requester.eq.${user.id},addressee.eq.${p.id}),and(requester.eq.${p.id},addressee.eq.${user.id})`),
    supabase.from("follows").select("follower", { count: "exact", head: true }).eq("followee", p.id),
    supabase.from("follows").select("followee", { count: "exact", head: true }).eq("follower", p.id),
    supabase.from("follows").select("follower").eq("follower", user.id).eq("followee", p.id).maybeSingle(),
  ]);
  const r = rel?.[0];
  const friends = r?.status === "accepted";
  const theyAsked = r?.status === "pending" && r.requester === p.id;
  const countries = new Set(cards.map((c) => c.trip.country_code).filter(Boolean)).size;
  // one pin per city, numbered with the trips there; it opens the latest of them
  const byCity = new Map<string, { id: string; lat: number; lng: number; count: number; label: string }>();
  for (const c of cards) {
    if (c.trip.dest_lat == null || c.trip.dest_lng == null) continue;
    const label = (c.trip.destination ?? c.trip.name).split(",")[0].trim();
    const pin = byCity.get(label);
    if (pin) pin.count++;
    else byCity.set(label, { id: c.trip.id, lat: c.trip.dest_lat, lng: c.trip.dest_lng, count: 1, label });
  }
  const pins = [...byCity.values()];
  const first = shortName(pp.name);

  return (
    <main className="mx-auto max-w-[430px] pb-10 wide:grid wide:max-w-5xl wide:grid-cols-2 wide:items-start wide:gap-8 wide:px-6 wide:pt-6">
      {/* wide: who they are and where they've been on the left, their trips on the right */}
      <div className="min-w-0">
      <section className="bg-gradient-to-b from-[#17707a] to-deeper px-6 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white wide:rounded-[24px]">
        <Link href="/community" aria-label="Back" className="-ml-2 grid h-10 w-10 place-items-center">
          <svg width="10" height="17" viewBox="0 0 10 17" aria-hidden><path d="M8.5 1.5 2 8.5l6.5 7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>
        </Link>
        <div className="mt-2 flex items-center gap-4">
          <Avatar p={pp} size={72} />
          <div className="min-w-0">
            <h1 className="truncate text-[21px] font-bold">{pp.name}</h1>
            {p.username && <p className="truncate text-[12px] text-[#8fbdb8]">@{p.username}</p>}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-4 text-center">
          {([[cards.length, cards.length === 1 ? "trip" : "trips"], [countries, countries === 1 ? "country" : "countries"], [followers ?? 0, "followers"], [following ?? 0, "following"]] as const).map(([n, l]) => (
            <div key={l}><dd className="text-[16px] font-bold">{n}</dd><dt className="text-[10px] text-[#8fbdb8]">{l}</dt></div>
          ))}
        </dl>
        {me ? (
          <div className="mt-5 flex items-center gap-2">
            <p className="flex-1 text-[11.5px] text-[#bfe4e0]">This is how other travellers see you.</p>
            <Link href="/profile" className="min-h-[40px] content-center rounded-full bg-white/15 px-4 text-[12px] font-bold">Your profile</Link>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            <form action={toggleFollow.bind(null, p.id, !iFollow, undefined)}>
              <button aria-pressed={Boolean(iFollow)} className={`min-h-[40px] rounded-full px-4 text-[12px] font-bold ${iFollow ? "bg-white/15 text-white" : "bg-coral text-white"}`}>{iFollow ? "Following" : "Follow"}</button>
            </form>
            {friends ? (
              <span className="min-h-[40px] content-center rounded-full bg-white/15 px-4 text-[12px] font-bold">Friends ✓</span>
            ) : theyAsked ? (
              <form action={async () => { "use server"; await respondToFriend(p.id, true); }}>
                <button className="min-h-[40px] rounded-full bg-white px-4 text-[12px] font-bold text-deep">Accept friend request</button>
              </form>
            ) : r ? (
              <span className="min-h-[40px] content-center rounded-full bg-white/15 px-4 text-[12px] font-bold text-[#bfe4e0]">Request sent</span>
            ) : (
              <form action={async () => { "use server"; await sendFriendRequest(p.id); }}>
                <button className="min-h-[40px] rounded-full bg-white px-4 text-[12px] font-bold text-deep">Add friend</button>
              </form>
            )}
            {(friends || cards.some((c) => c.trip.is_public)) && (
              <Link href={`/messages/${p.id}`} className="min-h-[40px] content-center rounded-full bg-white/15 px-4 text-[12px] font-bold">Message</Link>
            )}
          </div>
        )}
      </section>

      {cards.length > 0 && pins.length > 0 && (
        <section className="mt-6 px-6 wide:px-0">
          <h2 className="mb-2 text-[11px] font-bold text-ink">Where {me ? "you've" : `${first} has`} been</h2>
          <LinkedMap pins={pins} base="/community" zoom={2.6} pointZoom={4} className="h-[220px] rounded-[18px] wide:h-[300px]" />
        </section>
      )}
      </div>

      <div className="min-w-0 px-6 wide:px-0">
        {cards.length ? (
          <>
            <section className="mt-6 wide:mt-0">
              <h2 className="mb-2 text-[11px] font-bold text-ink">{me ? "Trips others can see" : `${first}'s trips`} · {cards.length}</h2>
              <ul className="space-y-3">
                {cards.map((c) => (
                  <li key={c.trip.id}>
                    <Link href={`/community/${c.trip.id}`} className="flex gap-3 overflow-hidden rounded-[18px] bg-card p-2.5 shadow-card">
                      <span className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[12px]">
                        <Cover url={c.coverUrl} seed={c.trip.id} className="absolute inset-0 h-full w-full" />
                      </span>
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-bold text-ink">{c.trip.name}</span>
                          {!c.trip.is_public && <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[9.5px] font-bold text-deep">FRIENDS</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted">{formatRange(c.trip.start_date, c.trip.end_date)} · {c.days} {c.days === 1 ? "day" : "days"}</span>
                        {c.route && <span className="mt-0.5 block truncate text-[11px] text-body">{c.route}</span>}
                        <span className="mt-1 block text-[11px] text-muted">{c.spend != null ? `${money(c.spend)} · ` : ""}♥ {c.likes}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <div className="mt-10 flex flex-col items-center text-center">
            <Ato size={96} mood="rest" />
            <h2 className="mt-3 text-[16px] font-bold text-ink">{me ? "You haven't shared a trip yet" : `${first} hasn't shared a trip with you yet`}</h2>
            <p className="mt-1 max-w-[280px] text-[12.5px] text-muted">
              {me ? "In a trip's options, choose who can see it: friends or everyone."
                : friends ? "Trips they share with friends or everyone will show here." : "Some trips are for friends only. Add them as a friend to see those too."}
            </p>
          </div>
        )}
        {!me && cards.length > 0 && !friends && (
          <p className="mt-4 text-center text-[11px] text-muted">Some of {first}&apos;s trips may be for friends only.</p>
        )}
      </div>
    </main>
  );
}
