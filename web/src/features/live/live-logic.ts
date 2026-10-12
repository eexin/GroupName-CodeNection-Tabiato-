/** Pure helpers for live-trip features — no network, unit-tested. */
import type { Hour } from "@/features/live/weather-types";

type Window = { from: number; to: number; peak: number };

export function rainWindow(hours: Hour[], threshold = 60): Window | null {
  let best = null as Window | null;
  let cur = null as Window | null;
  for (const h of hours.filter((x) => x.hour >= 8 && x.hour <= 20)) {
    if (h.rain >= threshold) {
      cur = cur ? { ...cur, to: h.hour + 1, peak: Math.max(cur.peak, h.rain) } : { from: h.hour, to: h.hour + 1, peak: h.rain };
      if (!best || cur.to - cur.from > best.to - best.from) best = cur;
    } else cur = null;
  }
  return best;
}

export function summary(hours: Hour[]) {
  if (!hours.length) return null;
  const day = hours.filter((h) => h.hour >= 8 && h.hour <= 20);
  const temps = day.map((h) => h.temp);
  return { min: Math.min(...temps), max: Math.max(...temps), rainMax: Math.max(...day.map((h) => h.rain)) };
}

export function tripDay(trip: { start_date: string | null; end_date: string | null }, localToday: string) {
  if (!trip.start_date) return null;
  const n = Math.round((Date.parse(localToday) - Date.parse(trip.start_date)) / 86400000) + 1;
  const len = trip.end_date ? Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86400000) + 1 : n;
  return n >= 1 && n <= len ? { n, len } : null;
}


/**
 * Figma 33 "Swap Day 4 with Day 5" — find the first upcoming day with outdoor stops and the next
 * day with none, and swap them. If no all-indoor day follows, move the outdoor stops to the last day.
 */
export function planHazardSwap(stops: { id: string; day: number | null; category: string | null }[], today: number, lastDay: number) {
  const outdoor = (d: number) => stops.some((s) => s.day === d && s.category === "nature");
  const days = Array.from({ length: Math.max(0, lastDay - today + 1) }, (_, i) => today + i);
  const hit = days.find(outdoor);
  if (hit === undefined) return null;
  const safe = days.find((d) => d > hit && !outdoor(d));
  if (safe !== undefined) return { kind: "swap" as const, from: hit, to: safe };
  if (hit === lastDay) return null;
  return { kind: "move-outdoor" as const, from: hit, to: lastDay };
}
