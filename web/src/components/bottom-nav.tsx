"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Map",
    path: "M4 8.5 11.5 5.5 19 8.5 26 5.5v15L19 23.5 11.5 20.5 4 23.5ZM11.5 5.5v15M19 8.5v15",
  },
  { href: "/trips", label: "Trips", path: "M6 6.5h18M6 14.5h18M6 22.5h12" },
  {
    href: "/community",
    label: "Community",
    path: "M15 5.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19ZM18.6 11.4 13.4 13.4 11.4 18.6 16.6 16.6Z",
  },
  {
    href: "/profile",
    label: "Profile",
    path: "M15 14.6a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8ZM7 23.5c1-3.9 4-5.9 8-5.9s7 2 8 5.9",
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-line bg-card pb-[env(safe-area-inset-bottom)] wide:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[10px] ${
                  active ? "font-bold text-coral" : "font-medium text-muted"
                }`}
              >
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden
                  stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={tab.path} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
