"use client";

import { useEffect, useRef, useState } from "react";
import { LinkedMap } from "@/components/map-links";
import type { Pin } from "@/components/memory-map";

/** Height of the map once the sheet has been pulled all the way up (header plus a strip of map). */
const COLLAPSED = 220;
/** How far the sheet's rounded top overlaps the map. */
const OVERLAP = 28;

/**
 * Figma 05 Home on a phone: the map fills the top of the screen, the trips sheet sits over its
 * bottom edge, and pulling the sheet up squeezes the map instead of covering it — the map window
 * narrows around its centre until only a strip is left, then the list scrolls under that strip.
 * Plain page scrolling drives it, so it works with touch, wheel, keyboard and screen readers.
 * Once the scroll settles, the pins are re-framed inside whatever is still visible.
 * On a computer (lg) it is the usual side-by-side layout and none of this runs.
 */
export function MapSheet({ pins, dim, header, children }: { pins: Pin[]; dim?: boolean; header: React.ReactNode; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [inset, setInset] = useState<{ top: number; bottom: number } | undefined>();

  useEffect(() => {
    const el = win.current;
    const host = root.current;
    if (!el || !host) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    let full = 0;
    let raf = 0;
    let idle: number | undefined;

    const apply = () => {
      raf = 0;
      if (wide.matches) {
        el.style.height = "";
        el.style.removeProperty("--crop");
        el.dataset.collapsed = "false";
        return;
      }
      const h = Math.max(COLLAPSED, full - window.scrollY);
      const crop = (full - h) / 2;
      el.style.height = `${h}px`;
      el.style.setProperty("--crop", `${crop}px`);
      el.dataset.collapsed = h <= COLLAPSED ? "true" : "false";
      window.clearTimeout(idle);
      // the map's canvas keeps its full size and is only cropped, so pins near the top and bottom
      // edges get hidden; once the scroll stops, frame them inside the strip that is still showing
      // the header floats over the map too, so pins are kept below it (pins hang above their spot)
      idle = window.setTimeout(() => setInset({ top: crop + (head.current?.offsetHeight ?? 0), bottom: crop + OVERLAP }), 180);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const measure = () => {
      // 62% of the small viewport: the same on every load, and the URL bar can't make it jump
      full = Math.round(Math.min(window.innerHeight, document.documentElement.clientHeight) * 0.62);
      host.style.setProperty("--map-full", `${full}px`);
      apply();
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    wide.addEventListener("change", measure);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      wide.removeEventListener("change", measure);
      cancelAnimationFrame(raf);
      window.clearTimeout(idle);
    };
  }, []);

  return (
    <div ref={root} className="relative [--map-full:62svh] lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_420px]">
      <div ref={win} data-collapsed="false"
        className="group fixed inset-x-0 top-0 z-0 mx-auto h-[var(--map-full)] max-w-[430px] overflow-hidden data-[collapsed=true]:z-20 data-[collapsed=true]:rounded-b-[24px] data-[collapsed=true]:shadow-card lg:sticky lg:z-0 lg:mx-0 lg:h-dvh lg:max-w-none lg:rounded-none lg:shadow-none">
        {/* full-size map, slid up by half of what has been cropped so the centre stays in view */}
        <div className="absolute inset-x-0 h-[var(--map-full)] lg:h-full" style={{ top: "calc(-1 * var(--crop, 0px))" }}>
          <LinkedMap pins={pins} base="/trips" attribution={false} fitInset={inset} className={`absolute inset-0 ${dim ? "opacity-60" : ""}`} />
        </div>
        <div ref={head} className="absolute inset-x-0 top-0 z-10 lg:hidden">{header}</div>
        {/* the OSM credit is a licence requirement, so it sits where the sheet never covers it */}
        <p className="absolute bottom-[calc(28px+6px)] right-2 z-10 rounded-full bg-white/80 px-2 py-0.5 text-[9px] text-body group-data-[collapsed=true]:bottom-1.5 lg:bottom-2">
          © <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline">OpenFreeMap</a>{" "}
          © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer" className="underline">OpenMapTiles</a>{" "}
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>
        </p>
      </div>

      <section aria-labelledby="trips-heading"
        className="relative z-10 mt-[calc(var(--map-full)-28px)] min-h-[calc(100dvh-220px)] rounded-t-[28px] bg-paper px-6 pb-8 shadow-sheet lg:mt-0 lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:rounded-none lg:border-l lg:border-line lg:pt-4 lg:shadow-none">
        <div aria-hidden className="mx-auto h-[5px] w-12 translate-y-[12px] rounded-full bg-[#c7dad7] lg:hidden" />
        {children}
      </section>
    </div>
  );
}
