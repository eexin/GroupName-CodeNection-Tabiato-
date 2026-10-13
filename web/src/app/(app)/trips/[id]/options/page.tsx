import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteTrip } from "@/features/trips/actions";
import { BackHeader } from "@/components/ui";
import { DemoLocked } from "@/components/demo-notice";
import { requireUser } from "@/features/auth/guards";

const Chevron = () => (
  <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden><path d="M1 1 7 7 1 13" fill="none" stroke="#B9CFCC" strokeWidth={1.8} strokeLinecap="round" /></svg>
);

/** 36 Trip options, 36a sharing, 36c delete confirmation. */
export default async function OptionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ confirm?: string; locked?: string }> }) {
  const [{ id }, { confirm, locked }] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const { data: me } = await supabase.from("trip_members").select("status").eq("trip_id", id).eq("user_id", user.id).maybeSingle();
  if (me?.status !== "joined") redirect(`/trips/${id}`);
  const owner = trip.owner_id === user.id;
  const [{ count: photos }, { count: places }] = await Promise.all([
    supabase.from("photos").select("*", { count: "exact", head: true }).eq("trip_id", id),
    supabase.from("places").select("*", { count: "exact", head: true }).eq("trip_id", id),
  ]);

  const { data: others } = await supabase.from("trip_members").select("user_id").eq("trip_id", id).eq("status", "joined").neq("user_id", user.id);
  const { data: names } = others?.length ? await supabase.from("profiles").select("display_name").in("id", others.map((o) => o.user_id)) : { data: [] as { display_name: string }[] };
  const firsts = (names ?? []).map((n) => n.display_name.split(" ")[0]);
  const lose = firsts.length ? `${firsts.length > 1 ? `${firsts.slice(0, -1).join(", ")} and ${firsts.at(-1)}` : firsts[0]} lose access too` : null;

  if (confirm === "delete" && owner) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-[430px] place-items-center lg:max-w-none bg-deeper/90 px-8">
        <div className="w-full max-w-[400px] rounded-[26px] bg-card p-6 text-center shadow-sheet">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#c94a2c1f] text-[24px] text-coral-dark">!</div>
          <h1 className="mt-4 text-[21px] font-bold text-ink">Delete {trip.name}?</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-body">
            This removes {photos ?? 0} memories, {places ?? 0} places and the story Ato wrote. It can&apos;t be undone.
          </p>
          {lose && <p className="mt-3 rounded-[12px] bg-[#fff3e2] px-3 py-2 text-[11.5px] text-amber-ink">{lose}. Their photos are deleted with it.</p>}
          <form action={deleteTrip.bind(null, id)} className="mt-5">
            <button className="h-12 w-full rounded-[14px] bg-coral-dark text-[13.5px] font-bold text-white">Delete this trip</button>
          </form>
          <Link href={`/trips/${id}/options`} className="mt-3 block py-2 text-[13px] font-bold text-muted">Keep it</Link>
        </div>
      </main>
    );
  }


  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href={`/trips/${id}`} title={trip.name} subtitle={`${photos ?? 0} memories, ${places ?? 0} places`} />
      {locked && <DemoLocked />}
      <ul className="mx-6 divide-y divide-line rounded-[18px] bg-card shadow-card">
        {owner && <li><Link href={`/trips/${id}/edit`} className="flex items-center justify-between px-4 py-4 text-[13.5px] font-medium text-body">Edit trip details <Chevron /></Link></li>}
        <li><Link href={`/trips/${id}/members`} className="flex items-center justify-between px-4 py-4 text-[13.5px] font-medium text-body">Members and invites <Chevron /></Link></li>
        {trip.status === "finished" && (
          <>
            <li><Link href={`/trips/${id}/book`} className="flex items-center justify-between px-4 py-4 text-[13.5px] font-bold text-coral">Generate memory book <Chevron /></Link></li>
            <li><Link href={`/trips/${id}/book/print`} className="flex items-center justify-between px-4 py-4 text-[13.5px] font-medium text-body">Export as PDF <Chevron /></Link></li>
          </>
        )}
        {owner && trip.status === "ongoing" && (
          <li><Link href={`/trips/${id}/end`} className="flex items-center justify-between px-4 py-4 text-[13.5px] font-medium text-body">End trip <Chevron /></Link></li>
        )}
      </ul>

      {owner && (
        <ul className="mx-6 mt-4 divide-y divide-line rounded-[18px] bg-card shadow-card">
          <li><Link href={`/trips/${id}/share`} className="flex items-center justify-between px-4 py-4 text-[13.5px] font-medium text-body">
            <span>Share to Community<span className="block text-[11px] text-muted">{trip.is_public ? "Shared — tap to change what others see" : "Only people on this trip can see it"}</span></span><Chevron /></Link></li>
        </ul>
      )}

      {owner && (
        <Link href={`/trips/${id}/options?confirm=delete`} className="mt-8 block text-center text-[13px] font-bold text-coral-dark">Delete trip</Link>
      )}
    </main>
  );
}
