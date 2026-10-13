"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ato } from "@/components/ato";

const MAIN = [
  ["/", "Map"], ["/trips", "Trips"], ["/community", "Community"], ["/profile", "Profile"],
] as const;

/** Desktop sidebar (lg and up). On phones the bottom nav is used instead. */
export function DesktopNav({ unread, qr, feedback }: { unread: number; qr: string | null; feedback: string | null }) {
  const path = usePathname();
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const link = (href: string, label: string, extra?: React.ReactNode) => (
    <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}
      className={`flex min-h-[44px] items-center justify-between rounded-[12px] px-4 text-[14px] ${on(href) ? "bg-card font-bold text-coral shadow-card" : "font-medium text-body hover:bg-card/70"}`}>
      {label}{extra}
    </Link>
  );
  return (
    <aside aria-label="Main" className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-4 py-6 lg:flex">
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
  );
}
