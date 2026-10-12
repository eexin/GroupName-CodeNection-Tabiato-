import "server-only";

/**
 * Open-Meteo forecast — free for non-commercial use, no key, under 10,000 calls a day.
 * Licence CC BY 4.0: attribution is shown wherever the forecast appears.
 * Times come back in the destination's local time (timezone=auto), matching our wall-clock photos.
 */

import type { Hour } from "@/features/live/weather-types";
export type { Hour };
export type Forecast = { days: Record<string, Hour[]>; timezone: string };

export async function forecast(lat: number, lng: number): Promise<Forecast | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    `&hourly=precipitation_probability,weather_code,temperature_2m&forecast_days=7&timezone=auto`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = await res.json();
    const days: Record<string, Hour[]> = {};
    (j.hourly?.time ?? []).forEach((t: string, i: number) => {
      const day = t.slice(0, 10);
      (days[day] ??= []).push({
        time: t, hour: Number(t.slice(11, 13)),
        rain: j.hourly.precipitation_probability?.[i] ?? 0,
        code: j.hourly.weather_code?.[i] ?? 0,
        temp: Math.round(j.hourly.temperature_2m?.[i] ?? 0),
      });
    });
    return { days, timezone: j.timezone ?? "UTC" };
  } catch {
    return null;
  }
}

/** The longest run of daytime hours (8–20) with rain probability at or above `threshold`. */
export { rainWindow, summary } from "@/features/live/live-logic";
