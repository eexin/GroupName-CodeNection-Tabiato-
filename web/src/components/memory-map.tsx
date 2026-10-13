"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { LngLatBounds, Map as MLMap, Marker, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The Water World map. Real OpenFreeMap tiles (OSM data, no key) recoloured at runtime —
 * geography, coastlines and labels stay intact. Used for trips (home), places (trip view) and
 * manual photo placement. OSM attribution must stay visible (licence requirement).
 */

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
// MapLibre looks for its worker next to its own module, which the bundler doesn't emit;
// scripts/copy-map-worker.mjs copies it into public/ before dev and build
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

type Palette = { land: string; water: string; park: string; road: string; label: string; halo: string; boundary: string; bg: string; atmosphere: string };

/** Figma 24 map themes. Same real geography underneath; only the skin changes. */
const THEMES: Record<string, Palette> = {
  water: {
    land: "#F2EAD8", water: "#8FCFD0", park: "#D9E6C6", road: "#FFFFFF", label: "#3E6E78", halo: "rgba(255,255,255,0.85)", boundary: "#9DBFBB", bg: "bg-aqua-light",
    atmosphere: "linear-gradient(100deg, transparent 8%, rgba(255,255,255,0.18) 12%, transparent 17%), linear-gradient(100deg, transparent 48%, rgba(255,255,255,0.13) 52%, transparent 56%), radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(14,76,85,0.18) 100%)",
  },
  forest: {
    land: "#E8EDD8", water: "#9FC4B8", park: "#B5CF94", road: "#FBFAF2", label: "#3E5A2C", halo: "rgba(251,250,242,0.9)", boundary: "#A9BC8E", bg: "bg-[#dfe9cf]",
    atmosphere: "radial-gradient(circle at 15% 20%, rgba(255,250,220,0.35), transparent 30%), radial-gradient(circle at 80% 70%, rgba(255,250,220,0.25), transparent 28%), radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(46,74,30,0.2) 100%)",
  },
  night: {
    land: "#1E2A45", water: "#0F1B34", park: "#24344F", road: "#33466A", label: "#C9D4F2", halo: "rgba(15,27,52,0.9)", boundary: "#3A4C72", bg: "bg-[#0f1b34]",
    atmosphere: "radial-gradient(1px 1px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 34% 8%, #fff, transparent), radial-gradient(1.5px 1.5px at 62% 22%, #fff, transparent), radial-gradient(1px 1px at 82% 12%, #fff, transparent), radial-gradient(1px 1px at 90% 40%, #fff, transparent), radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(5,10,25,0.35) 100%)",
  },
};
const themeFromCookie = () => document.cookie.match(/(?:^|; )tabiato_theme=(\w+)/)?.[1] ?? "water";
const noSubscribe = () => () => {};

function recolour(map: MLMap, PALETTE: Palette) {
  const style = map.getStyle() as StyleSpecification;
  for (const layer of style.layers ?? []) {
    const id = layer.id.toLowerCase();
    try {
      if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", PALETTE.land);
      else if (layer.type === "fill" && id.includes("water")) map.setPaintProperty(layer.id, "fill-color", PALETTE.water);
      else if (layer.type === "fill" && /park|landcover|wood|grass/.test(id)) map.setPaintProperty(layer.id, "fill-color", PALETTE.park);
      else if (layer.type === "line" && /road|highway|street|path|bridge|tunnel/.test(id)) map.setPaintProperty(layer.id, "line-color", PALETTE.road);
      else if (layer.type === "line" && id.includes("boundary")) map.setPaintProperty(layer.id, "line-color", PALETTE.boundary);
      else if (layer.type === "symbol") {
        map.setPaintProperty(layer.id, "text-color", PALETTE.label);
        map.setPaintProperty(layer.id, "text-halo-color", PALETTE.halo);
      }
    } catch {
      // not every layer supports every paint property
    }
  }
}

export type Pin = { id: string; lng: number; lat: number; count: number; label?: string };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function pinEl(pin: Pin, onSelect?: (id: string) => void) {
  const el = document.createElement(onSelect ? "button" : "div");
  if (onSelect) (el as HTMLButtonElement).type = "button";
  el.setAttribute("aria-label", `${pin.label ?? "Place"}, ${pin.count} memories`);
  el.className = "group flex flex-col items-center focus:outline-none";
  const label = pin.label
    ? `<span class="mt-1 max-w-[110px] truncate rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-deep shadow-sm">${escapeHtml(pin.label)}</span>`
    : "";
  el.innerHTML = `
    <span class="relative grid h-11 w-11 place-items-center rounded-full bg-deep/90 text-[13px] font-bold text-white ring-2 ring-white/90 shadow-[0_4px_10px_rgba(14,76,85,0.3)] transition-transform group-hover:scale-110 group-focus-visible:scale-110">
      <span class="absolute left-2 top-1.5 h-2.5 w-2.5 rounded-full bg-white/50"></span>${pin.count}
    </span>${label}`;
  if (onSelect) el.addEventListener("click", (e) => { e.stopPropagation(); onSelect(pin.id); });
  return el;
}

/** Fit the pins into the part of the map that isn't covered (`inset`). */
function frame(map: MLMap, pins: Pin[], zoom: number, inset: { top: number; bottom: number } | undefined, duration: number) {
  const top = inset?.top ?? 0, bottom = inset?.bottom ?? 0;
  if (pins.length === 1) map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: Math.max(zoom, 13), offset: [0, (top - bottom) / 2], duration });
  else if (pins.length > 1) {
    const b = new LngLatBounds();
    pins.forEach((p) => b.extend([p.lng, p.lat]));
    // never ask for more padding than the map has room for, or MapLibre refuses to fit
    const h = map.getContainer().clientHeight;
    const pad = { top: 90 + top, bottom: 60 + bottom, left: 50, right: 50 };
    const room = h - pad.top - pad.bottom;
    if (room < 60) { const cut = (60 - room) / 2; pad.top = Math.max(top + 24, pad.top - cut); pad.bottom = Math.max(bottom + 12, pad.bottom - cut); }
    map.fitBounds(b, { padding: pad, maxZoom: 15, duration });
  }
}

type Props = {
  pins: Pin[];
  onSelect?: (id: string) => void;
  /** tap anywhere to report a location — used for placing photos by hand */
  onPick?: (lngLat: { lng: number; lat: number }) => void;
  picked?: { lng: number; lat: number } | null;
  center?: [number, number];
  zoom?: number;
  className?: string;
  atmosphere?: boolean;
  /** false when the page shows the OSM credit itself (it must stay visible somewhere) */
  attribution?: boolean;
  /** extra space to keep clear when framing the pins, e.g. what a sheet or header covers */
  fitInset?: { top: number; bottom: number };
};

export function MemoryMap({ pins, onSelect, onPick, picked, center = [118, 18], zoom = 2.6, className, atmosphere = true, attribution = true, fitInset }: Props) {
  // server renders the default; the browser switches to the saved theme right after hydration
  const themeName = useSyncExternalStore(noSubscribe, themeFromCookie, () => "water");
  const theme = THEMES[themeName] ?? THEMES.water;
  const themeRef = useRef(theme);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const pickMarker = useRef<Marker | null>(null);
  const ready = useRef(false);
  const pendingDraw = useRef<(() => void) | null>(null);
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  const fitInsetRef = useRef(fitInset);

  useEffect(() => {
    onPickRef.current = onPick;
    onSelectRef.current = onSelect;
    themeRef.current = theme;
    fitInsetRef.current = fitInset;
  });

  // a theme change after the map loaded repaints it
  useEffect(() => {
    if (ready.current && mapRef.current) recolour(mapRef.current, theme);
  }, [theme]);

  useEffect(() => {
    if (!box.current || mapRef.current) return;
    setWorkerUrl(WORKER_URL);
    const map = new MLMap({
      container: box.current,
      style: STYLE_URL,
      center,
      zoom,
      attributionControl: attribution ? { compact: true } : false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.on("load", () => { recolour(map, themeRef.current); ready.current = true; pendingDraw.current?.(); pendingDraw.current = null; });
    map.on("click", (e) => onPickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; ready.current = false; };
    // created once; the effects below keep it in sync with props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      markers.current.forEach((m) => m.remove());
      markers.current = pins.map((p) =>
        new Marker({ element: pinEl(p, onSelectRef.current ? (id) => onSelectRef.current?.(id) : undefined), anchor: "bottom" })
          .setLngLat([p.lng, p.lat])
          .addTo(map),
      );
      frame(map, pins, zoom, fitInsetRef.current, 0);
    };
    if (ready.current) draw();
    else pendingDraw.current = draw;
  }, [pins, zoom]);

  // the visible part of the map changed (a sheet slid over it): frame the pins in what's left
  const insetKey = fitInset ? `${Math.round(fitInset.top)}:${Math.round(fitInset.bottom)}` : "";
  useEffect(() => {
    if (ready.current && mapRef.current && insetKey) frame(mapRef.current, pins, zoom, fitInsetRef.current, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetKey]);



  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickMarker.current?.remove();
    pickMarker.current = picked ? new Marker({ color: "#E8623F" }).setLngLat([picked.lng, picked.lat]).addTo(map) : null;
  }, [picked]);

  return (
    <div role="region" aria-label={`Map with ${pins.length} ${pins.length === 1 ? "pin" : "pins"}. The same places are listed below the map.`}
      className={`${/(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className ?? "") ? "" : "relative"} overflow-hidden ${theme.bg} ${className ?? ""}`}>
      {/* inline, not Tailwind classes: MapLibre's stylesheet sets .maplibregl-map to position: relative
          and outranks Tailwind's layered utilities, which collapsed this box to 0 px tall. (For the
          same reason the outer box only gets "relative" when the caller hasn't positioned it.) */}
      <div ref={box} style={{ position: "absolute", inset: 0 }} />
      {atmosphere && (
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ background: theme.atmosphere }} />
      )}
    </div>
  );
}
