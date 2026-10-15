"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ato } from "@/components/ato";

const MAIN = [
  ["/", "Map"], ["/trips", "Trips"], ["/community", "Community"], ["/profile", "Profile"],
] as const;

// 30×30 line icons, the same drawing style as the bottom nav
const ICON: Record<string, string> = {
  "/": "M4 8.5 11.5 5.5 19 8.5 26 5.5v15L19 23.5 11.5 20.5 4 23.5ZM11.5 5.5v15M19 8.5v15",
  "/trips": "M6 6.5h18M6 14.5h18M6 22.5h12",
  "/community": "M15 5.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19ZM18.6 11.4 13.4 13.4 11.4 18.6 16.6 16.6Z",
  "/profile": "M15 14.6a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8ZM7 23.5c1-3.9 4-5.9 8-5.9s7 2 8 5.9",
  "/plan": "M6 8.5h18v15H6ZM6 13h18M11 5.5v5M19 5.5v5",
  "/search": "M13.5 20a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM18.5 18.5 24 24",
  "/messages": "M5.5 8h19v12.5H12l-5 3.8v-3.8H5.5Z",
  "/friends": "M11.5 14a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM4.5 23c.8-3.4 3.4-5.2 7-5.2s6.2 1.8 7 5.2M19 7.5a3 3 0 1 1 0 6M21.5 18c2 .6 3.4 2.2 4 4.6",
};
const SHORT: Record<string, string> = { "/plan": "Plan", "/search": "Search", "/messages": "Messages", "/friends": "Friends" };

/**
 * The main navigation once there is room beside the content (the bottom nav is for phones held upright).
 *   desk: the full sidebar — names, "New memory trip", a QR code to open the app on a phone
 *   land: a phone turned sideways — a slim icon rail, so the content keeps the width and nothing
 *         is cut off at 390px tall
 */
export function DesktopNav({ unread, qr, feedback }: { unread: number; qr: string | null; feedback: string | null }) {
  const path = usePathname();
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const link = (href: string, label: string, extra?: React.ReactNode) => (
    <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}
      className={`flex min-h-[44px] items-center justify-between rounded-[12px] px-4 text-[14px] ${on(href) ? "bg-card font-bold text-coral shadow-card" : "font-medium text-body hover:bg-card/70"}`}>
      {label}{extra}
    </Link>
  );
  const railItem = (href: string, label: string, badge?: number) => (
    <Link key={href} href={href} aria-current={on(href) ? "page" : undefined} aria-label={badge ? `${label}, ${badge} unread` : label}
      className={`relative flex h-[40px] w-full shrink-0 flex-col items-center justify-center rounded-[12px] text-[9px] leading-none ${on(href) ? "bg-card font-bold text-coral shadow-card" : "font-medium text-muted"}`}>
      <svg width="24" height="24" viewBox="0 0 30 30" fill="none" aria-hidden stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d={ICON[href]} /></svg>
      <span aria-hidden className="mt-0.5">{label}</span>
      {badge ? <span aria-hidden className="absolute right-2 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">{badge}</span> : null}
    </Link>
  );
  return (
    <>
      <aside aria-label="Main" className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-4 py-6 desk:flex">
        <Link href="/" className="mb-5 flex items-center gap-2 px-2">
          <Ato size={46} />
          <span className="text-[19px] font-bold text-ink">Tabiato <span className="text-[15px] font-normal text-coral">旅跡</span></span>
        </Link>
        <nav className="flex flex-col gap-1">{MAIN.map(([h, l]) => link(h, l))}</nav>
        <Link href="/trips/new" className="mt-4 flex min-h-[44px] items-center justify-center rounded-[14px] bg-coral text-[14px] font-bold text-white">+ New memory trip</Link>
        <div className="mt-3 flex flex-col gap-1">
          {link("/plan", "Plan a trip")}
          {link("/search", "Search memories")}
          {link("/messages", "Messages", unread ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-coral px-1.5 text-[11px] font-bold text-white">{unread}</span> : null)}
          {link("/friends", "Friends")}
          {feedback && (
            <a href={feedback} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center rounded-[12px] px-4 text-[14px] font-medium text-body hover:bg-card/70">Send feedback ↗</a>
          )}
        </div>
        <div className="mt-auto rounded-[18px] bg-card p-4 shadow-card">
          <p className="text-[13px] font-bold text-ink">Made for your phone</p>
          <p className="mt-1 text-[11.5px] leading-snug text-muted">Recording a trip works best in your pocket. Scan to open Tabiato on your phone.</p>
          {/* smaller on laptop-height screens, so the whole sidebar fits without being cut off */}
          {qr && <div className="mx-auto mt-3 w-36 [@media(max-height:880px)]:w-24 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR code to open Tabiato on your phone" dangerouslySetInnerHTML={{ __html: qr }} />}
        </div>
      </aside>

      {/* phone turned sideways: the notch side gets its safe-area padding, the rail scrolls if it must */}
      <aside aria-label="Main" className="sticky top-0 hidden h-dvh w-[calc(68px+env(safe-area-inset-left))] shrink-0 flex-col items-center overflow-y-auto border-r border-line bg-surface py-[max(0.375rem,env(safe-area-inset-top))] pl-[calc(0.375rem+env(safe-area-inset-left))] pr-1.5 land:flex">
        {MAIN.map(([h, l]) => railItem(h, l))}
        <Link href="/trips/new" aria-label="New memory trip" className="my-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral shadow-fab">
          <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden><path d="M11 4v14M4 11h14" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" /></svg>
        </Link>
        {(["/plan", "/search", "/messages", "/friends"] as const).map((h) => railItem(h, SHORT[h], h === "/messages" ? unread : undefined))}
      </aside>
    </>
  );
}
