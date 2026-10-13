"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placePhotos } from "@/features/places/photo-actions";
import { MemoryMap, type Pin } from "@/components/memory-map";
import { buttonClass } from "@/components/ui";

export function Placer({ tripId, photos, pins }: { tripId: string; photos: { id: string; url: string | null }[]; pins: Pin[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(photos.map((p) => p.id)));
  const [picked, setPicked] = useState<{ lng: number; lat: number } | null>(null);
  const [busy, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function save() {
    if (!picked || !selected.size) return;
    start(async () => {
      await placePhotos(tripId, [...selected], picked.lat, picked.lng);
      router.push(`/trips/${tripId}`);
      router.refresh();
    });
  }

  return (
    <div className="px-6">
      <p className="text-[12px] text-muted">Pick the photos taken at the same spot, then tap where that was.</p>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {photos.map((p) => (
          <li key={p.id} className="shrink-0">
            <button onClick={() => toggle(p.id)} aria-pressed={selected.has(p.id)}
              className={`relative h-20 w-20 overflow-hidden rounded-[12px] ring-2 ${selected.has(p.id) ? "ring-coral" : "ring-transparent opacity-50"}`}>
              {p.url ? <img src={p.url} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-surface" />}
            </button>
          </li>
        ))}
      </ul>
      <MemoryMap pins={pins} picked={picked} onPick={setPicked} zoom={pins.length ? 12 : 2.6} className="mt-4 h-[380px] rounded-[20px]" />
      <p className="mt-2 text-center text-[11px] text-muted">{picked ? "Pin dropped. Tap again to move it." : "Tap the map where these were taken."}</p>
      <button onClick={save} disabled={!picked || !selected.size || busy} className={`${buttonClass("primary")} mt-4`}>
        {busy ? "Placing…" : `Place ${selected.size} photo${selected.size === 1 ? "" : "s"} here`}
      </button>
    </div>
  );
}
