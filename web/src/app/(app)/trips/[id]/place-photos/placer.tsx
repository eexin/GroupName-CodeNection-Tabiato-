"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { findPlace, placePhotos } from "@/features/places/photo-actions";
import { MemoryMap, type Pin } from "@/components/memory-map";
import { buttonClass } from "@/components/ui";
import { mapsLink } from "@/lib/geo";

type Hit = Awaited<ReturnType<typeof findPlace>>[number];

/**
 * Figma 08 → place photos by hand. Two ways to say where: search for the place (or paste a Google
 * Maps link) and pick a result, or tap the map. Either way the pin is only a suggestion until
 * the user presses Place — we never guess a location for them.
 */
export function Placer({ tripId, photos, pins, near }: { tripId: string; photos: { id: string; url: string | null }[]; pins: Pin[]; near?: { lat: number; lng: number } | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(photos.map((p) => p.id)));
  const [picked, setPicked] = useState<{ lng: number; lat: number } | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedArea, setPickedArea] = useState("");   // shown under the map; never saved as the name
  const [focus, setFocus] = useState<{ lng: number; lat: number; bbox?: [number, number, number, number] } | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [busy, start] = useTransition();

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    startSearch(async () => setHits(await findPlace(query, near ?? null)));
  }
  function choose(h: Hit) {
    const at = { lng: h.lng, lat: h.lat };
    setPicked(at); setFocus({ ...at, bbox: h.bbox }); setPickedName(h.name); setPickedArea(h.detail.split(" · ").pop() ?? ""); setHits(null);
  }

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function save() {
    if (!picked || !selected.size) return;
    start(async () => {
      await placePhotos(tripId, [...selected], picked.lat, picked.lng, pickedName ?? undefined);
      router.push(`/trips/${tripId}`);
      router.refresh();
    });
  }

  return (
    <div className="px-6">
      <p className="text-[12px] text-muted">Pick the photos taken at the same spot, then search for where that was, or tap it on the map.</p>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {photos.map((p) => (
          <li key={p.id} className="shrink-0">
            <button onClick={() => toggle(p.id)} aria-pressed={selected.has(p.id)} aria-label={selected.has(p.id) ? "Photo selected" : "Photo not selected"}
              className={`relative h-20 w-20 overflow-hidden rounded-[12px] ring-2 ${selected.has(p.id) ? "ring-coral" : "ring-transparent opacity-50"}`}>
              {p.url ? <img src={p.url} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-surface" />}
            </button>
          </li>
        ))}
      </ul>

      <form role="search" onSubmit={search} className="mt-4 flex items-center gap-2 rounded-full border-[1.5px] border-coral bg-card py-1.5 pl-4 pr-1.5 has-[input:focus]:ring-[3px] has-[input:focus]:ring-coral/30">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a place, or paste a Maps link"
          aria-label="Search for the place these photos were taken" className="h-9 flex-1 bg-transparent text-[13.5px] placeholder:text-muted focus:outline-none" />
        <button disabled={searching || query.trim().length < 2} className="h-9 shrink-0 rounded-full bg-coral px-4 text-[12px] font-bold text-white disabled:opacity-60">
          {searching ? "Searching…" : "Search"}
        </button>
      </form>
      {hits && (
        <div className="mt-2 overflow-hidden rounded-[16px] bg-card shadow-card">
          {hits.length ? (
            <ul className="divide-y divide-line">
              {hits.map((h) => (
                <li key={h.ref}>
                  <button type="button" onClick={() => choose(h)} className="block w-full px-4 py-2.5 text-left">
                    <span className="block truncate text-[13px] font-bold text-ink">{h.name}</span>
                    {h.detail && <span className="block truncate text-[11px] text-muted">{h.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="px-4 py-3 text-[12px] text-muted">I couldn&apos;t find &ldquo;{query.trim()}&rdquo;. Try a nearby landmark, the street, or the city name.</p>
          )}
        </div>
      )}

      <MemoryMap pins={pins} picked={picked} focus={focus} onPick={(at) => { setPicked(at); setPickedName(null); setPickedArea(""); }}
        zoom={pins.length ? 12 : 2.6} className="mt-4 h-[340px] rounded-[20px]" />
      <p role="status" className="mt-2 text-center text-[11.5px] text-muted">
        {picked
          ? pickedName ? <><strong className="text-ink">{pickedName}</strong>{pickedArea ? `, ${pickedArea}` : ""}. Tap the map to fine-tune the pin.</> : "Pin dropped. Tap again to move it."
          : "Search above, or tap the map where these were taken."}
      </p>
      {picked && (
        <p className="mt-1 text-center">
          <a href={mapsLink(picked.lat, picked.lng)} target="_blank" rel="noopener noreferrer" className="inline-block min-h-[32px] content-center text-[12px] font-bold text-deep underline-offset-2 hover:underline">
            Check this spot on Google Maps ↗
          </a>
        </p>
      )}
      <button onClick={save} disabled={!picked || !selected.size || busy} className={`${buttonClass("primary")} mt-4`}>
        {busy ? "Placing…" : `Place ${selected.size} photo${selected.size === 1 ? "" : "s"} here`}
      </button>
    </div>
  );
}
