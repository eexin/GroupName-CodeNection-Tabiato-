import Link from "next/link";
import { Ato } from "@/components/ato";
import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";



/** 28 Planner menu — the planner is optional and lives off the main flow. */
export default async function PlannerMenu() {
  const { supabase, user } = await requireUser();
  const { data: rows } = await supabase.from("trip_members").select("trip_id").eq("user_id", user.id).eq("status", "joined");
  const ids = (rows ?? []).map((r) => r.trip_id);
  const { data: trips } = ids.length
    ? await supabase.from("trips").select("id, name, status").in("id", ids).in("status", ["planned", "ongoing"]).order("start_date")
    : { data: [] as { id: string; name: string; status: string }[] };
  const planned = (trips ?? []).find((t) => t.status === "planned");
  const current = (trips ?? []).find((t) => t.status === "ongoing") ?? planned;
  const ROWS: [string, string, string | null][] = [
    ["Plan a trip with AI", "Itinerary from your Travel DNA", "/plan/new"],
    ["My itineraries", "Trips you have planned", "/trips?tab=planned"],
    ["Group preferences", planned ? "Compare what everyone wants" : "Plan a trip with friends first", planned ? `/plan/${planned.id}/board` : null],
    ["Trip intel & alerts", current ? `Entry rules, news and alerts for ${current.name}` : "Shows up once you have a trip", current ? `/trips/${current.id}/intel` : null],
  ];
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] wide:max-w-2xl wide:pt-4 pb-10">
      <BackHeader href="/" title="Planner" subtitle="Optional — plan before you go" />
      <div className="px-6">
        <ul className="divide-y divide-line rounded-[18px] bg-card shadow-card">
          {ROWS.map(([t, sub, href]) => (
            <li key={t}>
              {href ? (
                <Link href={href} className="block px-4 py-4">
                  <span className="block text-[13.5px] font-bold text-ink">{t}</span>
                  <span className="block text-[11px] text-muted">{sub}</span>
                </Link>
              ) : (
                <div className="px-4 py-4 opacity-60" aria-disabled>
                  <span className="block text-[13.5px] font-bold text-ink">{t}</span>
                  <span className="block text-[11px] text-muted">{sub}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex items-center gap-3 text-[12px] leading-snug text-muted">
          <Ato size={56} />When you press Start trip, a plan becomes a memory trip and I start recording against it.
        </div>
      </div>
    </main>
  );
}
