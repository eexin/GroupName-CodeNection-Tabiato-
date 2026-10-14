import Link from "next/link";
import { notFound } from "next/navigation";
import { leaveTrip, remindInvite, removeMember, setMemberRole } from "@/features/trips/actions";
import { Avatar, AtoNote, BackHeader, ButtonLink } from "@/components/ui";
import { DemoLocked } from "@/components/demo-notice";
import { requireUser } from "@/features/auth/guards";
import { getTrip } from "@/features/trips/data";
import { PersonLink } from "@/components/ui";

/** 21 Trip members, with the owner's ••• menu and the leave confirmation. */
export default async function MembersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ confirm?: string; locked?: string; reminded?: string }> }) {
  const [{ id }, { confirm, locked, reminded }] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireUser();
  const t = await getTrip(supabase, id, user.id);
  if (!t) notFound();
  const joined = t.members.filter((m) => m.status === "joined");
  const pending = t.members.filter((m) => m.status === "invited");
  const { count: mine } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("trip_id", id).eq("uploaded_by", user.id);

  if (confirm === "leave" && t.isMember && !t.isOwner) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-[430px] place-items-center lg:max-w-none bg-deeper/90 px-8">
        <div className="w-full max-w-[400px] rounded-[26px] bg-card p-6 text-center shadow-sheet">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#a33a221f] text-[24px] font-bold text-coral-dark">!</div>
          <h1 className="mt-4 text-[21px] font-bold text-ink">Leave {t.trip.name}?</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-body">
            You&apos;ll lose access to its map, its {t.photoCount} memories and the story Ato wrote.
          </p>
          <form action={leaveTrip.bind(null, id)} className="mt-4 text-left">
            {(mine ?? 0) > 0 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-[#fff3e2] px-3 py-3 text-[12px] text-amber-ink">
                <input type="checkbox" name="remove_photos" className="mt-0.5 h-5 w-5 accent-[#a33a22]" />
                <span>
                  <strong className="block">Also delete the {mine} photo{mine === 1 ? "" : "s"} I added</strong>
                  Leave it unticked and they stay on the trip for everyone else.
                </span>
              </label>
            )}
            <button className="mt-4 h-12 w-full rounded-[14px] bg-coral-dark text-[13.5px] font-bold text-white">Leave this trip</button>
          </form>
          <Link href={`/trips/${id}/members`} className="mt-3 block py-2 text-[13px] font-bold text-muted">Keep it</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href={`/trips/${id}`} title={`${t.trip.name} members`} subtitle={`${joined.length} people, ${t.photoCount} memories`} />
      {locked && <DemoLocked />}
      <div className="space-y-3 px-6">
        <h2 className="text-[11px] font-bold text-ink">Members</h2>
        {joined.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
            <PersonLink id={m.person.id} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar p={m.person} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold text-ink">{m.person.name}</p>
              <p className="text-[10.5px] text-muted">{m.role === "owner" ? "Owner" : m.role === "viewer" ? "Can't add photos — can rate, note and comment" : "Can add photos"}</p>
            </div>
            </PersonLink>
            {m.user_id === user.id ? (
              <span className="rounded-full bg-surface px-3 py-1 text-[10.5px] font-bold text-deep">You</span>
            ) : t.isOwner ? (
              <details className="relative">
                <summary aria-label={`Options for ${m.person.name}`} className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full text-[18px] font-bold text-muted">•••</summary>
                <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-[14px] bg-card shadow-sheet">
                  <form action={setMemberRole.bind(null, id, m.user_id, m.role === "viewer" ? "contributor" : "viewer")}>
                    <button className="block w-full px-4 py-3 text-left text-[12.5px] text-ink">{m.role === "viewer" ? "Let them add photos" : "Make view-only"}</button>
                  </form>
                  <form action={removeMember.bind(null, id, m.user_id)}>
                    <button className="block w-full border-t border-line px-4 py-3 text-left text-[12.5px] font-bold text-coral-dark">Remove from trip</button>
                  </form>
                </div>
              </details>
            ) : null}
          </div>
        ))}

        {pending.length > 0 && <h2 className="pt-3 text-[11px] font-bold text-ink">Pending</h2>}
        {pending.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 opacity-80 shadow-card">
            <Avatar p={m.person} />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-ink">{m.person.name}</p>
              <p className="text-[10.5px] text-muted">Invited · {m.role === "viewer" ? "view only" : "can add photos"}</p>
            </div>
            {t.isOwner && (
              <div className="flex items-center">
                {reminded === m.user_id
                  ? <span className="px-2 text-[11.5px] font-bold text-deep">Reminded</span>
                  : <form action={remindInvite.bind(null, id, m.user_id)}><button className="min-h-[40px] rounded-full bg-surface px-3 text-[11.5px] font-bold text-deep">Remind</button></form>}
                <form action={removeMember.bind(null, id, m.user_id)}>
                  <button className="min-h-[40px] px-2 text-[11.5px] font-bold text-muted">Cancel</button>
                </form>
              </div>
            )}
          </div>
        ))}

        <div className="pt-3">
          <AtoNote label="Shared memories">Everyone&apos;s photos land on the same map, grouped by place and time.</AtoNote>
        </div>
        {t.isOwner && <div className="pt-2"><ButtonLink href={`/trips/${id}/invite`} variant="outline">Invite more people</ButtonLink></div>}
        {!t.isOwner && t.isMember && (
          <Link href={`/trips/${id}/members?confirm=leave`} className="block pt-4 text-center text-[13px] font-bold text-coral-dark">Leave this trip</Link>
        )}
      </div>
    </main>
  );
}
