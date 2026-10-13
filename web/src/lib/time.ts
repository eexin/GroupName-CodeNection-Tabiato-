/**
 * Photo times are stored as "wall-clock time encoded as UTC". EXIF has no timezone, and a
 * photo taken at 7:24 in Bali should read 7:24 no matter where it is uploaded from later.
 * So we keep the local clock reading and always read it back with getUTC*.
 */
export function wallClockToIso(d: Date): string {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()),
  ).toISOString();
}

export function hourOf(iso: string) {
  return new Date(iso).getUTCHours();
}

export function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatHour12(h: number) {
  const hh = ((h + 11) % 12) + 1;
  return `${hh}${h < 12 || h === 24 ? "am" : "pm"}`;
}

export function formatRange(start: string | null, end: string | null) {
  if (!start) return "No dates yet";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  const s = new Date(start + "T00:00:00Z");
  if (!end || end === start) return s.toLocaleDateString("en-GB", opts);
  const e = new Date(end + "T00:00:00Z");
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  return sameMonth
    ? `${s.getUTCDate()}–${e.toLocaleDateString("en-GB", opts)}`
    : `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${e.toLocaleDateString("en-GB", opts)}`;
}

/** "just now", "5m", "3h", "yesterday", "4d", then a date — for activity and when something was shared. */
export function timeAgo(iso: string, now: number = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
