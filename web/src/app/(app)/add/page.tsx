import Link from "next/link";
import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getMyTrips } from "@/features/trips/data";

function Option({ href, title, sub, color }: { href: string; title: string; sub: string; color: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-[18px] bg-card p-4 shadow-card">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `${color}24` }}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M9 3v12M3 9h12" stroke={color} strokeWidth={2} strokeLinecap="round" /></svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-ink">{title}</span>
        <span className="block text-[11px] text-muted">{sub}</span>
      </span>
    </Link>
  );
}

/** 15 Add — what are you adding? */
export default async function AddPage() {
  const { supabase, user } = await requireUser();
  const [all, { data: roles }] = await Promise.all([
    getMyTrips(supabase, user.id),
    supabase.from("trip_members").select("trip_id, role").eq("user_id", user.id),
  ]);
  const viewOnly = new Set((roles ?? []).filter((r) => r.role === "viewer").map((r) => r.trip_id));
  // finished trips no longer take photos, and view-only members can't add any
  const trips = all.filter((t) => t.trip.status === "ongoing" && !viewOnly.has(t.trip.id));
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] wide:max-w-2xl wide:pt-4 pb-10">
      <BackHeader href="/" title="Add to Tabiato" subtitle="What are you adding?" />
      <div className="space-y-3 px-6">
        {trips.slice(0, 3).map((t) => (
          <Option key={t.trip.id} href={`/trips/${t.trip.id}/upload`} title={`Add photos to ${t.trip.name}`}
            sub="Ato will pin them by location" color="#E8623F" />
        ))}
        <Option href="/trips/new" title="Create a memory trip" sub="Start recording a new journey" color="#0E4C55" />
        <Option href="/plan" title="Plan a trip with AI" sub="Build an itinerary first" color="#7FC9C2" />
      </div>
    </main>
  );
}
