import { decodeLook, renderLook } from "@/lib/character";

/**
 * A character as an SVG image: /api/avatar/s2.c1.hair_long (head and shoulders, used wherever a
 * profile photo goes) or ?view=full (the whole character). The code fully describes the picture,
 * so the response never changes and is cached for a year. Public, like profile photos.
 */
export async function GET(request: Request, { params }: { params: Promise<{ look: string }> }) {
  const { look: code } = await params;
  const look = decodeLook(decodeURIComponent(code).replace(/\.svg$/, ""));
  if (!look) return new Response("Unknown look", { status: 404 });
  const view = new URL(request.url).searchParams.get("view") === "full" ? "full" : "bust";
  return new Response(renderLook(look, view), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // an SVG opened on its own may not run anything
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
