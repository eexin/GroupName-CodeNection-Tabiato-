import Link from "next/link";
import { DemoLocked } from "@/components/demo-notice";
import { removeFriend, respondToFriend } from "@/features/friends/actions";
import { Ato } from "@/components/ato";
import { Avatar, BackHeader, Empty } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { person } from "@/lib/people";
import { profileLink } from "@/features/friends/link";
import { CopyButton } from "@/components/copy-button";

/** 22 Friends and 22b empty state. */
export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const { locked } = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: rows } = await supabase.from("friendships").select("*");
  const all = rows ?? [];
  const incoming = all.filter((f) => f.addressee === user.id && f.status === "pending");
  const outgoing = all.filter((f) => f.requester === user.id && f.status === "pending");
  const friends = all.filter((f) => f.status === "accepted");
  const ids = all.map((f) => (f.requester === user.id ? f.addressee : f.requester));
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] as { id: string; display_name: string }[] };
  const who = new Map((profiles ?? []).map((p) => [p.id, person(p.id, p.display_name)]));
  const other = (f: { requester: string; addressee: string }) => who.get(f.requester === user.id ? f.addressee : f.requester)!;
  const { data: me } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const link = me?.username ? await profileLink(me.username) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href="/profile" title="Friends"
        right={<Link href="/friends/add" aria-label="Add a friend" className="grid h-9 w-9 place-items-center rounded-full bg-deep text-[20px] leading-none text-white">+</Link>} />
      {locked && <DemoLocked />}
      <div className="px-6">
        <form action="/friends/add" role="search" className="mb-4">
          <input name="q" placeholder="Search by name or email" aria-label="Search by name or email"
            className="h-[46px] w-full rounded-full border border-line bg-card px-5 text-[13.5px] placeholder:text-muted focus:border-coral focus:outline-none" />
        </form>
        {incoming.length > 0 && <h2 className="mb-2 text-[11px] font-bold text-ink">Requests</h2>}
        {incoming.map((f) => (
          <div key={f.requester} className="mb-3 flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
            <Avatar p={other(f)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold text-ink">{other(f).name}</p>
              <p className="text-[10.5px] text-muted">wants to travel with you</p>
            </div>
            <form action={respondToFriend.bind(null, f.requester, true)}><button className="rounded-full bg-coral px-3 py-1.5 text-[11px] font-bold text-white">Accept</button></form>
            <form action={respondToFriend.bind(null, f.requester, false)}><button className="rounded-full bg-surface px-3 py-1.5 text-[11px] font-bold text-muted">Skip</button></form>
          </div>
        ))}

        {friends.length === 0 && incoming.length === 0 ? (
          <>
          <Empty title="No friends yet" action={<Link href="/friends/add" className="flex h-12 items-center justify-center rounded-[15px] bg-coral text-[14px] font-bold text-white">Add a friend</Link>}>
            Add the people you travel with so your photos land on the same map.
          </Empty>
          {link && (
            <div className="mt-2 rounded-[18px] bg-card p-4 shadow-card">
              <p className="text-[10.5px] font-bold text-muted">OR SHARE YOUR LINK</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="truncate text-[12.5px] font-medium text-ink">{link.replace(/^https?:\/\//, "")}</span>
                <CopyButton text={link} />
              </div>
            </div>
          )}
          </>
        ) : (
          <>
            <h2 className="mb-2 mt-4 flex justify-between text-[11px] font-bold text-ink">All friends <span className="text-muted">{friends.length}</span></h2>
            <ul className="space-y-3">
              {friends.map((f) => (
                <li key={`${f.requester}-${f.addressee}`} className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
                  <Avatar p={other(f)} />
                  <p className="flex-1 truncate text-[13.5px] font-bold text-ink">{other(f).name}</p>
                  <Link href={`/messages/${other(f).id}`} className="min-h-[40px] content-center px-2 text-[11.5px] font-bold text-deep">Message</Link>
                  <form action={removeFriend.bind(null, other(f).id)}><button className="text-[11px] font-bold text-muted">Remove</button></form>
                </li>
              ))}
            </ul>
          </>
        )}

        {outgoing.length > 0 && (
          <p className="mt-6 text-[11.5px] text-muted">Waiting on: {outgoing.map((f) => other(f).name).join(", ")}</p>
        )}
        <div className="mt-8 flex items-center gap-3 text-[12px] text-muted"><Ato size={48} mood="happy" />Trips are better logged together.</div>
      </div>
    </main>
  );
}
