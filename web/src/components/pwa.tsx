"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Registers the service worker in production builds, and clears it out of development. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // A service worker registered by any production build on this port keeps serving cached
      // /_next/static files, and in development those filenames are built from the module path
      // and never change — so it hands back yesterday's code indefinitely, and the fix you just
      // made appears not to work. Clear it out instead of leaving people to debug a ghost.
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => ("caches" in window ? caches.keys() : []))
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const noop = () => () => {};
const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** "Install Tabiato" — the real prompt on Android/desktop Chrome, instructions on iPhone. */
export function InstallHint() {
  // device facts are read on the client only; the server renders nothing
  const standalone = useSyncExternalStore(noop, isStandalone, () => true);
  const ios = useSyncExternalStore(noop, isIOS, () => false);
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || dismissed || (!evt && !ios)) return null;
  return (
    <div className="mt-6 flex items-center gap-3 rounded-[18px] bg-card p-4 shadow-card">
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-ink">Install Tabiato</p>
        <p className="text-[11px] text-muted">
          {evt ? "Full screen, on your home screen, like any app." : "Tap the Share button, then “Add to Home Screen”."}
        </p>
      </div>
      {evt && (
        <button onClick={async () => { await evt.prompt(); setDismissed(true); }} className="min-h-[40px] rounded-full bg-coral px-4 text-[12px] font-bold text-white">
          Install
        </button>
      )}
    </div>
  );
}
