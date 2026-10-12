/**
 * Where to go after login. Only same-site paths are allowed: "/u/max" yes;
 * "//evil.com", "https://evil.com", "/\\evil.com" and "javascript:…" no — an open redirect would let
 * a crafted login link send people to a phishing page.
 */
export function safeNext(next: string | null | undefined): string {
  const n = (next ?? "").trim();
  if (!n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return "/";
  if (!/^\/[\w\-/?=&%.~]*$/.test(n)) return "/";
  return n;
}
