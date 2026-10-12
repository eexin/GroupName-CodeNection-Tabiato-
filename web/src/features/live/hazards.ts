import "server-only";
import { distanceM } from "@/lib/geo";

/**
 * GDACS — the UN / European Commission Global Disaster Alert and Coordination System.
 * Free, no key. GDACS itself states its automated alerts carry uncertainty and do NOT replace
 * warnings from local authorities, so every screen that shows one says so.
 */

import type { Hazard } from "@/lib/types";
export type { Hazard };

export const HAZARD_LABEL: Record<string, string> = {
  EQ: "Earthquake", TC: "Tropical cyclone", FL: "Flood", VO: "Volcano", WF: "Wildfire", DR: "Drought",
};

export async function hazardsNear(lat: number, lng: number, radiusKm = 800): Promise<Hazard[]> {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86400000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;WF` +
    `&alertlevel=orange;red&fromdate=${d(from)}&todate=${d(to)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 }, headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const j = await res.json();
    const out: Hazard[] = [];
    for (const f of j.features ?? []) {
      const p = f.properties ?? {};
      const [flng, flat] = f.geometry?.coordinates ?? [];
      if (typeof flat !== "number" || typeof flng !== "number") continue;
      const km = distanceM(lat, lng, flat, flng) / 1000;
      if (km > radiusKm) continue;
      out.push({
        id: `${p.eventtype}-${p.eventid}`, type: p.eventtype, name: p.name || p.eventname || HAZARD_LABEL[p.eventtype] || "Event",
        level: p.alertlevel, country: p.country ?? "", from: p.fromdate, to: p.todate ?? null,
        lat: flat, lng: flng, km: Math.round(km), url: p.url?.report ?? p.url?.details ?? null,
      });
    }
    return out.sort((a, b) => (a.level === "Red" ? -1 : 1) - (b.level === "Red" ? -1 : 1) || a.km - b.km);
  } catch {
    return [];
  }
}
