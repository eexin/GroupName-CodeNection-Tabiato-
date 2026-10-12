import Link from "next/link";
import { Avatars, Cover } from "@/components/ui";
import type { TripSummary } from "@/features/trips/data";
import { formatRange } from "@/lib/time";

export function TripRow({ s }: { s: TripSummary }) {
  const ongoing = s.trip.status === "ongoing";
  return (
    <Link href={`/trips/${s.trip.id}`} className="flex items-center gap-3 rounded-[18px] bg-card p-2.5 shadow-card active:scale-[0.99]">
      <Cover url={s.coverUrl} seed={s.trip.id} className="h-12 w-12 shrink-0 rounded-[14px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold text-ink">{s.trip.name}</span>
        <span className="block text-[10.5px] text-muted">{s.memories} memories, {s.places} places</span>
      </span>
      <span className={`shrink-0 self-start pt-1 text-[10px] font-medium ${ongoing ? "text-coral" : "text-muted"}`}>
        {ongoing ? "Ongoing" : formatRange(s.trip.start_date, s.trip.end_date)}
      </span>
    </Link>
  );
}

export function TripCard({ s }: { s: TripSummary }) {
  const built = Boolean((s.trip as { plan_style?: { built_at?: string } }).plan_style?.built_at);
  const badge = s.trip.status === "ongoing" ? "Ongoing" : s.trip.status === "planned" ? (built ? "Itinerary ready" : "Draft") : null;
  return (
    <Link href={`/trips/${s.trip.id}`} className="block overflow-hidden rounded-[20px] bg-card shadow-card active:scale-[0.99]">
      <span className="relative block">
        <Cover url={s.coverUrl} seed={s.trip.id} className="h-24 w-full" />
        {badge && <span className="absolute left-4 top-3.5 rounded-full bg-white/95 px-3 py-1 text-[9.5px] font-bold text-coral">{badge}</span>}
      </span>
      <span className="flex items-end justify-between gap-3 px-[18px] pb-3.5 pt-2.5">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold text-ink">{s.trip.name}</span>
          <span className="block text-[11px] text-muted">{s.memories} memories, {s.places} places</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-[10.5px] font-medium text-muted">{formatRange(s.trip.start_date, s.trip.end_date)}</span>
          <Avatars people={s.members} />
        </span>
      </span>
    </Link>
  );
}
