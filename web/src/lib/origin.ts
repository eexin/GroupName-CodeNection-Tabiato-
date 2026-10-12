import "server-only";
import { headers } from "next/headers";

/** This deployment's own origin, e.g. https://tabiato.vercel.app — for auth redirect links. */
export async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
