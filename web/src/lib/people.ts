const PALETTE = ["#0E4C55", "#E8623F", "#5C7FA8", "#7FC9C2", "#C99A3E", "#7A6BA8"];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export type Person = { id: string; name: string; initials: string; color: string; avatar?: string | null };

export function person(id: string, name: string | null | undefined, avatar?: string | null): Person {
  const n = name?.trim() || "Traveller";
  return { id, name: n, initials: initials(n), color: colorFor(id), avatar: avatar ?? null };
}
