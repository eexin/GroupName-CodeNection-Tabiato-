import type { Trip } from "@/lib/types";

/** Figma 23, the top of Community. Pure, so it is unit-tested. */

/** The city part of a destination ("Tokyo, Japan" → "Tokyo"): how trips are grouped into destinations. */
export const placeName = (t: Pick<Trip, "destination" | "name">) => (t.destination ?? t.name).split(",")[0].trim();

type CardLike = { trip: Pick<Trip, "destination" | "name">; likes: number; coverUrl: string | null };

export type Destination = { name: string; trips: number; likes: number; coverUrl: string | null };

/** "Trending destinations": public trips grouped by city, most shared (then most liked) first. */
export function trending(cards: CardLike[], max = 8): Destination[] {
  const by = new Map<string, Destination>();
  for (const c of cards) {
    const name = placeName(c.trip);
    const d = by.get(name) ?? { name, trips: 0, likes: 0, coverUrl: null };
    d.trips++; d.likes += c.likes; d.coverUrl ??= c.coverUrl;
    by.set(name, d);
  }
  return [...by.values()].sort((a, b) => b.trips - a.trips || b.likes - a.likes).slice(0, max);
}
