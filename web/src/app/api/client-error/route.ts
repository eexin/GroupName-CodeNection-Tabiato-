import { NextResponse } from "next/server";

/** Errors caught by error.tsx in the browser are logged here, so they appear in the Vercel logs. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.error("[client-error]", JSON.stringify({
      message: String(body.message ?? "").slice(0, 500),
      digest: String(body.digest ?? ""),
      path: String(body.path ?? "").slice(0, 200),
      ua: req.headers.get("user-agent")?.slice(0, 160),
    }));
  } catch {
    // never let error reporting itself throw
  }
  return new NextResponse(null, { status: 204 });
}
