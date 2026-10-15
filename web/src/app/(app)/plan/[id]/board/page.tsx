import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, AtoNote, BackHeader, buttonClass } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { person, shortName } from "@/lib/people";
import { groupConflicts } from "@/features/planner/itinerary";
import { savedStyle } from "@/features/planner/learn";
import { clock } from "@/features/planner/style";
import type { TravelStyle } from "@/lib/types";
import { PersonLink } from "@/components/ui";

const BUDGET: Record<string, string> = { budget: "Budget", mid: "Mid-range", luxury: "Luxury" };

/** 30 Group preference board — surfaces where people differ; the trip leader decides. */
export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const { data: members } = await supabase.from("trip_members").select("user_id").eq("trip_id", id).eq("status", "joined");
  const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url, travel_style").in("id", (members ?? []).map((m) => m.user_id));
  const people = (profiles ?? []).map((p) => ({ ...person(p.id, p.display_name, p.avatar_url), style: (p.travel_style ?? {}) as TravelStyle, learned: savedStyle(p.travel_style) }));
  const { data: pinned } = await supabase.from("plan_stops").select("name, added_by, fixed_day, fixed_time").eq("trip_id", id).eq("source", "user").not("fixed_day", "is", null);
  const nameOf = new Map(people.map((p) => [p.id, shortName(p.name)]));
  const conflicts = groupConflicts(
    people.map((p) => ({ name: p.name, budget: p.style.budget, pace: p.style.pace, interests: p.style.interests, start: p.learned?.dayStart })),
    (pinned ?? []).map((s) => ({ name: s.name, by: nameOf.get(s.added_by) ?? "Someone", fixed_day: s.fixed_day, fixed_time: s.fixed_time })),
  );
  const owner = trip.owner_id === user.id;

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 wide:max-w-5xl wide:pt-4">
      <BackHeader href={`/plan/${id}/places`} title="Preference board" subtitle={`${people.length} travellers — ${owner ? "you" : "the trip leader"} make${owner ? "" : "s"} the final call`} />
      {/* wide: everyone's preferences on the left; where you differ and the decision on the right */}
      <div className="px-6 wide:grid wide:grid-cols-2 wide:items-start wide:gap-8">
        <div className="min-w-0 space-y-3">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
            <PersonLink id={p.id} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar p={p} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-ink">{p.name}{p.id === user.id ? " (you)" : ""}</p>
                <p className="truncate text-[11px] text-muted">{(p.style.interests ?? []).join(", ") || "No interests set"}</p>
              </div>
            </PersonLink>
            <div className="text-right text-[11px]">
              <p className="font-bold text-deep">{BUDGET[p.style.budget ?? ""] ?? "—"}</p>
              <p className="text-muted">{p.style.pace ?? "—"} pace</p>
              {p.learned?.dayStart != null && <p className="text-muted">out by {clock(p.learned.dayStart)}</p>}
            </div>
          </div>
        ))}

        </div>
        <div className="mt-3 min-w-0 space-y-3 wide:mt-0">
        {conflicts.length > 0 && <h2 className="pt-3 text-[11px] font-bold text-ink wide:pt-0">Where you differ</h2>}
        {conflicts.map((c) => (
          <div key={c.title} className={`rounded-[14px] border-l-4 px-4 py-3 ${c.title === "Shared interests" ? "border-aqua bg-surface" : "border-sand bg-[#fff3e2]"}`}>
            <p className="text-[12.5px] font-bold text-ink">{c.title}</p>
            <p className="text-[11.5px] text-body">{c.detail}</p>
          </div>
        ))}

        <div className="pt-2"><AtoNote label="How this works">I surface the gaps — you make the call. Nobody gets scored.</AtoNote></div>
        {owner
          ? <Link href={`/plan/${id}/build`} className={`${buttonClass("primary")} mt-2`}>Confirm itinerary</Link>
          : <p className="pt-2 text-center text-[12px] text-muted">Waiting for the trip leader to confirm.</p>}
        </div>
      </div>
    </main>
  );
}
