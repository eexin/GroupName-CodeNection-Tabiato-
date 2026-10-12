"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** "Nearby" needs the phone's location — asked only when tapped. */
export function NearbyChip({ active }: { active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" aria-pressed={active} disabled={busy}
      onClick={() => {
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
          (p) => router.push(`/community?filter=nearby&near=${p.coords.latitude.toFixed(3)},${p.coords.longitude.toFixed(3)}`),
          () => { setBusy(false); alert("Allow location to see trips near you."); },
          { timeout: 10000 },
        );
      }}
      className={`min-h-[40px] rounded-full px-4 text-[12.5px] ${active ? "bg-coral font-bold text-white" : "border border-line bg-card text-body"}`}>
      {busy ? "Locating…" : "Nearby"}
    </button>
  );
}
