"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** How long to wait for the phone's location before saying so; some in-app browsers never answer. */
const GIVE_UP_MS = 12_000;

/**
 * "Nearby" needs the phone's location, asked only when tapped. The chip always comes back to
 * life: after the page changes, after an error, and when the browser never answers at all.
 * Problems show as a short message above the tab bar, not a blocking alert.
 */
export function NearbyChip({ active }: { active: boolean }) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const giveUp = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(giveUp.current), []);
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 7000);
    return () => window.clearTimeout(t);
  }, [error]);

  const fail = (message: string) => { window.clearTimeout(giveUp.current); setLocating(false); setError(message); };

  function locate() {
    if (locating) return;
    setError(null);
    if (!("geolocation" in navigator)) return fail("This browser can't share your location. Try Safari or Chrome.");
    setLocating(true);
    giveUp.current = window.setTimeout(() => fail("I couldn't get your location. Check that Location is on for your browser, then try again."), GIVE_UP_MS);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        window.clearTimeout(giveUp.current);
        setLocating(false);
        // about 1 km of precision is plenty for "trips near me", and keeps the exact spot private
        const near = `${p.coords.latitude.toFixed(2)},${p.coords.longitude.toFixed(2)}`;
        startLoading(() => router.push(`/community?filter=nearby&near=${near}`));
      },
      (e) => fail(e.code === e.PERMISSION_DENIED
        ? "Location is off for this site. Allow it in your browser settings to see trips near you."
        : "I couldn't find where you are right now. Try again in a moment."),
      { timeout: GIVE_UP_MS - 1000, maximumAge: 10 * 60_000 },
    );
  }

  const busy = locating || loading;
  return (
    <>
      <button type="button" aria-pressed={active} aria-busy={busy} onClick={locate}
        className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-[12.5px] ${active ? "bg-coral font-bold text-white" : "border border-line bg-card text-body"}`}>
        {/* the widest label reserves the space, so the chips beside it never jump */}
        <span className="grid">
          <span aria-hidden className="invisible col-start-1 row-start-1">Locating…</span>
          <span className="col-start-1 row-start-1">{locating ? "Locating…" : loading ? "Loading…" : "Nearby"}</span>
        </span>
      </button>
      {error && (
        <p role="alert" className="fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-40 mx-auto w-[calc(100%-2.5rem)] max-w-[390px] rounded-[14px] bg-deep px-4 py-3 text-[12.5px] leading-snug text-white shadow-sheet lg:bottom-6">
          {error}
        </p>
      )}
    </>
  );
}
