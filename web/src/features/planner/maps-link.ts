/** Figma 35 "Search a place, or paste a link" — reads a place out of a Google Maps link. Pure; tested. */
export const MAPS_LINK = /^https?:\/\/(?:(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)\S*$/i;
export const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

export function parseMapsLink(url: string): { name: string; lat: number; lng: number } | null {
  const num = (s: string) => Number(s);
  // the place's own pin (!3d…!4d…) beats the camera position (@…)
  const pin = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const q = url.match(/[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const c = pin ?? q ?? at;
  if (!c) return null;
  const lat = num(c[1]), lng = num(c[2]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
  const named = url.match(/\/place\/([^/@?]+)/);
  const name = named ? decodeURIComponent(named[1].replace(/\+/g, " ")).trim() : "Pinned place";
  return { name, lat, lng };
}
