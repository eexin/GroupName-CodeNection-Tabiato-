import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { inviteToTrip } from "@/features/trips/actions";
import { CopyButton } from "@/components/copy-button";
import { Avatar, BackHeader, buttonClass } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getFriends } from "@/features/trips/friends";
import { origin } from "@/lib/origin";
import { person } from "@/lib/people";

/** 20 Invite friends — search your friends or an email, or share a join link. */
export default async function InvitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ id }, { q = "" }] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("id, name, owner_id, invite_code").eq("id", id).maybeSingle();
  if (!trip) notFound();
  if (trip.owner_id !== user.id) redirect(`/trips/${id}/members`);

  let code = trip.invite_code as string | null;
  if (!code) {
    code = randomBytes(9).toString("base64url"); // 12 characters, unguessable
    await supabase.from("trips").update({ invite_code: code }).eq("id", id).eq("owner_id", user.id);
  }
  const link = `${await origin()}/join/${code}`;

  const term = q.trim();
  const [friends, { data: members }, found] = await Promise.all([
    getFriends(supabase, user.id),
    supabase.from("trip_members").select("user_id, status").eq("trip_id", id),
    term.includes("@") ? supabase.rpc("find_profile", { q: term }) : Promise.resolve({ data: [] }),
  ]);
  const status = new Map((members ?? []).map((m) => [m.user_id, m.status]));
  const list = [
    ...friends.filter((f) => !term || f.name.toLowerCase().includes(term.toLowerCase())),
    ...((found.data as { id: string; display_name: string }[]) ?? []).filter((p) => !friends.some((f) => f.id === p.id)).map((p) => person(p.id, p.display_name)),
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 lg:max-w-2xl lg:pt-4">
      <BackHeader href={`/trips/${id}/members`} title={`Invite to ${trip.name}`} />
      <div className="space-y-4 px-6">
        <form role="search">
          <input name="q" defaultValue={q} placeholder="Search friends or email" aria-label="Search friends or email"
            className="h-[46px] w-full rounded-full border border-line bg-card px-5 text-[13.5px] placeholder:text-muted focus:border-coral focus:outline-none" />
        </form>
        <div className="flex items-center gap-3 rounded-[18px] bg-card p-4 shadow-card">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink">Share invite link</p>
            <p className="truncate text-[11px] text-muted">{link.replace(/^https?:\/\//, "")}</p>
          </div>
          <CopyButton text={link} />
        </div>
        <h2 className="pt-2 text-[11px] font-bold text-ink">Your friends</h2>
        {list.length === 0 && (
          <p className="text-[12.5px] text-muted">{term ? `No one matches “${term}”. Search by full email to invite someone who isn't a friend yet.` : <>No friends yet — <Link href="/friends/add" className="font-bold text-coral">add one</Link>, or share the link above.</>}</p>
        )}
        <ul className="space-y-3">
          {list.map((p) => {
            const s = status.get(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
                <Avatar p={p} />
                <p className="flex-1 truncate text-[13.5px] font-bold text-ink">{p.name}</p>
                {s ? <span className="rounded-full bg-surface px-3 py-1.5 text-[11px] font-bold text-muted">{s === "joined" ? "Joined" : "Invited"}</span> : (
                  <form action={async () => { "use server"; await inviteToTrip(id, p.id); }}>
                    <button className="min-h-[40px] rounded-full bg-coral px-4 text-[11.5px] font-bold text-white">Invite</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        <Link href={`/trips/${id}/members`} className={`${buttonClass("quiet")} mt-4`}>Done</Link>
      </div>
    </main>
  );
}
