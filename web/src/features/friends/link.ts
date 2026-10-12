import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** The absolute URL of someone's add-me link, built from the request so it works on any deploy. */
export async function profileLink(username: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/u/${username}`;
}

/** A QR code (SVG markup) for that link — friends point their phone camera at it. */
export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#12312F", light: "#FFFFFF" } });
}
