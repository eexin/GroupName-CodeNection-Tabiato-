"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { generateMemoryBook } from "@/features/memory-book/actions";
import { clusterTrip } from "@/features/places/photo-actions";
import { Ato } from "@/components/ato";
import { AtoNote, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isHeic, prepareImage as prepare } from "@/lib/image";
import { wallClockToIso } from "@/lib/time";
import type { LocationSource } from "@/lib/types";
import type { Person } from "@/lib/people";
import { MemoryDetails } from "./details";

type Item = {
  key: string;
  file: File;
  preview: string | null;
  lat: number | null;
  lng: number | null;
  source: LocationSource;
  takenAt: Date | null;
};

type Phase = "pick" | "review" | "uploading" | "details" | "done";


function deviceLocation(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10000 });
  });
}

async function readExif(file: File) {
  try {
    const { default: exifr } = await import("exifr");
    const [gps, meta] = await Promise.all([exifr.gps(file), exifr.parse(file, ["DateTimeOriginal", "CreateDate"])]);
    const t = meta?.DateTimeOriginal ?? meta?.CreateDate;
    return {
      lat: typeof gps?.latitude === "number" ? gps.latitude : null,
      lng: typeof gps?.longitude === "number" ? gps.longitude : null,
      takenAt: t instanceof Date && !Number.isNaN(t.getTime()) ? t : null,
    };
  } catch {
    return { lat: null, lng: null, takenAt: null };
  }
}

const noSubscribe = () => () => {};
/** iPhone and iPad (iPadOS reports itself as a Mac with a touch screen). */
const onIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** `hasStory`: the trip ended and Ato already wrote its story, so new photos can go into a rewrite. */
export function Uploader({ tripId, tripName, userId, autoPin = true, members = [], currency = "MYR", hasStory = false }: { tripId: string; tripName: string; userId: string; autoPin?: boolean; members?: Person[]; currency?: string; hasStory?: boolean }) {
  const router = useRouter();
  const [rewriting, startRewrite] = useTransition();
  const ios = useSyncExternalStore(noSubscribe, onIos, () => false);
  const [phase, setPhase] = useState<Phase>("pick");
  const [items, setItems] = useState<Item[]>([]);
  const [reading, setReading] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [result, setResult] = useState<{ places: number; photos: number; top: { id: string; name: string; first_seen_at: string | null } | null } | null>(null);
  const counter = useRef(0);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>, fromCamera: boolean) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setReading(true);
    // the phone's own position is only meaningful for a photo taken right now
    const here = fromCamera && autoPin ? await deviceLocation() : null;
    const next: Item[] = [];
    for (const file of files) {
      // "Auto-pin photos by location" off: keep the time, ignore the GPS, the user places every photo
      const exif = autoPin ? await readExif(file) : { ...(await readExif(file)), lat: null, lng: null };
      let { lat, lng } = exif;
      let source: LocationSource = lat !== null ? "exif" : "none";
      if (lat === null && here) {
        lat = here.coords.latitude;
        lng = here.coords.longitude;
        source = "device";
      }
      next.push({
        key: `f${counter.current++}`,
        file,
        preview: isHeic(file) ? null : URL.createObjectURL(file),
        lat, lng, source,
        takenAt: exif.takenAt ?? (fromCamera ? new Date() : null),
      });
    }
    setItems((prev) => [...prev, ...next]);
    setReading(false);
    setPhase("review");
  }

  function remove(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function upload() {
    setPhase("uploading");
    const supabase = createClient();
    let ok = 0;
    let bad = 0;
    for (const item of items) {
      try {
        const { blob, width, height } = await prepare(item.file);
        const path = `${tripId}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const ins = await supabase.from("photos").insert({
          trip_id: tripId,
          uploaded_by: userId,
          storage_path: path,
          taken_at: item.takenAt ? wallClockToIso(item.takenAt) : null,
          lat: item.source === "none" ? null : item.lat,
          lng: item.source === "none" ? null : item.lng,
          location_source: item.source,
          width,
          height,
        });
        if (ins.error) throw ins.error;
        ok++;
      } catch {
        bad++;
      }
      setDone(ok + bad);
      setFailed(bad);
    }
    const r = ok ? await clusterTrip(tripId) : { places: 0, photos: 0, top: null };
    setResult(r);
    setPhase(r.top ? "details" : "done");
  }

  const located = items.filter((i) => i.source !== "none").length;
  const unlocated = items.length - located;

  if (phase === "details" && result?.top) {
    return <MemoryDetails place={result.top} tripId={tripId} members={members} currency={currency} onDone={() => setPhase("done")} />;
  }

  if (phase === "done") {
    const saved = done - failed;
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <Ato size={120} mood="happy" />
        <h2 className="mt-4 text-[22px] font-bold text-ink">{saved} {saved === 1 ? "memory" : "memories"} saved</h2>
        <p className="mt-2 max-w-[280px] text-[12.5px] leading-relaxed text-muted">
          {result?.photos ? `I pinned ${result.photos} to ${tripName}${result.places ? `, including ${result.places} new place${result.places === 1 ? "" : "s"}` : ""}.` : "They're saved to the trip."}
          {unlocated > 0 && ` ${unlocated} had no location — place them on the map when you're ready.`}
          {failed > 0 && ` ${failed} couldn't be uploaded; try those again.`}
        </p>
        {hasStory && saved > 0 && (
          <div className="mt-6 w-full text-left">
            <AtoNote label="Ato can update your story" mood="happy">
              I wrote your story before these {saved === 1 ? "photo" : "photos"} arrived. Want me to rewrite it with {saved === 1 ? "it" : "them"} in?
            </AtoNote>
          </div>
        )}
        <div className="mt-8 w-full space-y-3">
          {hasStory && saved > 0 && (
            <button disabled={rewriting} className={buttonClass("primary")}
              onClick={() => startRewrite(async () => { await generateMemoryBook(tripId); router.push(`/trips/${tripId}/book`); })}>
              {rewriting ? "Rewriting your story…" : "Rewrite my story"}
            </button>
          )}
          <Link href={`/trips/${tripId}`} className={buttonClass(hasStory && saved > 0 ? "quiet" : "primary")}>See them on the map</Link>
          <button onClick={() => { setItems([]); setDone(0); setFailed(0); setPhase("pick"); }} className={buttonClass("quiet")}>Add more photos</button>
        </div>
      </div>
    );
  }

  if (phase === "uploading") {
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    return (
      <div className="flex flex-col items-center px-8 pt-16 text-center">
        <Ato size={120} />
        <h2 className="mt-5 text-[19px] font-bold text-ink">{done < items.length ? `Uploading ${done + 1} of ${items.length}` : "Grouping into places"}</h2>
        <div className="mt-5 h-2 w-full rounded-full bg-surface" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 rounded-full bg-coral transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-[11.5px] text-muted">Keep this screen open until it finishes.</p>
      </div>
    );
  }

  return (
    <div className="px-6">
      {phase === "review" && items.length > 0 && (
        <>
          <h2 className="mb-3 text-[17px] font-bold text-ink">Select photos</h2>
          <AtoNote label="Before you upload">
            <strong className="text-ink">{located} of {items.length} photos have a location.</strong>{" "}
            {located ? "I'll pin them to places automatically." : ""}
            {unlocated ? ` ${unlocated} ${unlocated === 1 ? "doesn't" : "don't"} — I won't guess; you'll place ${unlocated === 1 ? "it" : "them"} after.` : ""}
          </AtoNote>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {items.map((i) => (
              <li key={i.key} className="relative aspect-square overflow-hidden rounded-[14px] bg-surface">
                {i.preview
                  ? <img src={i.preview} alt={`Selected photo: ${i.file.name}`} className="h-full w-full object-cover" />
                  : <span className="grid h-full place-items-center text-[10px] font-bold text-muted">HEIC</span>}
                <span className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${i.source === "none" ? "bg-white/90 text-coral-dark" : "bg-deep/85 text-white"}`}>
                  {i.source === "none" ? "No location" : i.source === "device" ? "Here" : "Located"}
                </span>
                <button onClick={() => remove(i.key)} aria-label="Remove photo"
                  className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[15px] font-bold text-ink">×</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {phase === "pick" && (
        <div className="flex flex-col items-center pb-4 pt-8 text-center">
          <Ato size={110} />
          <p className="mt-4 max-w-[280px] text-[12.5px] leading-relaxed text-muted">
            Pick photos from your camera roll, or take one now. I read where and when each was taken.
          </p>
          {/* Since iOS 17 Safari leaves the location out of library photos unless the user turns it
              on in the picker, so without this tip every photo arrives "without a location". */}
          {ios && (
            <p className="mt-4 rounded-[14px] bg-surface px-4 py-3 text-left text-[12px] leading-snug text-body">
              <strong className="text-ink">On iPhone:</strong> in the photo picker, tap <strong className="text-ink">Options</strong> at the top and turn on <strong className="text-ink">Location</strong>, so I can pin your photos for you.
            </p>
          )}
        </div>
      )}

      {reading && <p className="mt-4 text-center text-[12px] text-muted">Reading photo details…</p>}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className={`${buttonClass("deep")} cursor-pointer text-[13.5px]`}>
          From library
          <input type="file" accept="image/*,.heic,.heif" multiple className="sr-only" onChange={(e) => onPick(e, false)} />
        </label>
        <label className={`${buttonClass("quiet")} cursor-pointer text-[13.5px]`}>
          Take a photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPick(e, true)} />
        </label>
      </div>

      {phase === "review" && items.length > 0 && (
        <button onClick={upload} className={`${buttonClass("primary")} mt-3`}>
          Continue with {items.length} photo{items.length === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
