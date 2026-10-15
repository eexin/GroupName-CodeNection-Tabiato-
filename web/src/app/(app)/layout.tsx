import { headers } from "next/headers";
import { DesktopNav } from "@/components/desktop-nav";
import { requireUser } from "@/features/auth/guards";
import { qrSvg } from "@/features/friends/link";

/**
 * Every signed-in screen. Phone upright: one column and the bottom nav. Wide (a computer, or a phone
 * turned sideways): navigation on the left — a sidebar on a computer, an icon rail on a phone.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const [{ count }, qr] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient", user.id).is("read_at", null),
    host ? qrSvg(`${proto}://${host}/`) : Promise.resolve(null),
  ]);
  return (
    <div className="wide:flex wide:min-h-dvh">
      <DesktopNav unread={count ?? 0} qr={qr} feedback={process.env.NEXT_PUBLIC_FEEDBACK_URL || null} />
      <div className="min-w-0 flex-1 land:pr-[env(safe-area-inset-right)]">{children}</div>
    </div>
  );
}
