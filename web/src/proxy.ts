import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/env";

/**
 * Next 16 renamed middleware to proxy. This one keeps the Supabase auth session fresh.
 * It does nothing until the Supabase env vars are set, so the app runs on demo data first.
 */
const PUBLIC = ["/start", "/login", "/signup", "/setup", "/exif-test", "/offline", "/forgot-password", "/auth", "/api/health", "/api/client-error"];

function redirectTo(request: NextRequest, pathname: string, keepTarget = false) {
  const url = request.nextUrl.clone();
  const target = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = pathname;
  url.search = keepTarget && target !== "/" ? `?next=${encodeURIComponent(target)}` : "";
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  if (!hasSupabase) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Refreshes the session cookie if it has expired — do not remove. getClaims reads the session
  // (refreshing it when needed) and then verifies the token's signature here rather than asking
  // the Auth server, which saves a round trip on every single request. Routes still check for
  // themselves via requireUser; this only decides whether to send someone to the login page.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));
  if (!signedIn && path === "/") return redirectTo(request, "/start");
  if (!signedIn && !isPublic) return redirectTo(request, "/login", true);
  if (signedIn && (path === "/login" || path === "/signup")) return redirectTo(request, "/");

  return response;
}

export const config = {
  // skip static files, images, the map worker (public/maplibre) and Vercel's own analytics scripts
  // — redirecting those to /login served them as HTML and the browser refused to run them
  matcher: ["/((?!_next/static|_next/image|_vercel/|favicon.ico|sw\\.js|manifest\\.webmanifest|maplibre/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ttf|ico)$).*)"],
};
