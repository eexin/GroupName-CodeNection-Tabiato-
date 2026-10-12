"use client";

/**
 * EXIF / location test page — web/src/app/exif-test/page.tsx
 *
 * Purpose: find out, on real phones, which upload paths keep GPS.
 * Must be opened on the DEPLOYED https URL — geolocation does not work on plain http.
 *
 * Each person tests on their own phone, then taps "Copy report" and pastes it
 * into the group chat.
 */

import { useState } from "react";

type Row = {
  path: string;          // which input was used
  name: string;
  type: string;          // image/heic = original came through; image/jpeg = may have been converted
  sizeKB: number;
  lat: number | null;
  lng: number | null;
  takenAt: string | null;
  device: string | null;
  deviceLat: number | null; // phone location at the moment of selection
  deviceLng: number | null;
  error?: string;
};

function getDeviceLocation(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function readOne(file: File, path: string): Promise<Row> {
  const base: Row = {
    path,
    name: file.name,
    type: file.type || "(empty)",
    sizeKB: Math.round(file.size / 1024),
    lat: null, lng: null, takenAt: null, device: null,
    deviceLat: null, deviceLng: null,
  };
  try {
    // loaded on demand so the server never tries to evaluate it
    const { default: exifr } = await import("exifr");
    const gps = await exifr.gps(file);
    const meta = await exifr.parse(file, ["DateTimeOriginal", "Make", "Model"]);
    return {
      ...base,
      lat: gps?.latitude ?? null,
      lng: gps?.longitude ?? null,
      takenAt: meta?.DateTimeOriginal ? new Date(meta.DateTimeOriginal).toISOString() : null,
      device: meta?.Make || meta?.Model ? `${meta?.Make ?? ""} ${meta?.Model ?? ""}`.trim() : null,
    };
  } catch (e) {
    return { ...base, error: String(e) };
  }
}

export default function ExifTestPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>, path: string) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    // capture the phone's own location at the moment of selection — this is the fallback for camera shots
    const pos = await getDeviceLocation();
    const results = await Promise.all(files.map((f) => readOne(f, path)));
    const withDevice = results.map((r) => ({
      ...r,
      deviceLat: pos?.coords.latitude ?? null,
      deviceLng: pos?.coords.longitude ?? null,
    }));
    setRows((prev) => [...withDevice, ...prev]);
    setBusy(false);
    e.target.value = "";
  }

  function report() {
    const ua = navigator.userAgent;
    const lines = rows.map((r) =>
      [
        r.path,
        r.type,
        `${r.sizeKB}KB`,
        r.lat !== null ? "GPS ✅" : "GPS ❌",
        r.takenAt ? "time ✅" : "time ❌",
        r.deviceLat !== null ? "device-loc ✅" : "device-loc ❌",
        r.error ? `error: ${r.error}` : "",
      ].join(" | ")
    );
    return `Device: ${ua}\n` + lines.join("\n");
  }

  const btn = "block w-full rounded-2xl px-4 py-4 text-center font-semibold text-white";

  return (
    <main className="mx-auto max-w-md space-y-4 p-5 text-[#12312F]">
      <h1 className="text-2xl font-bold">EXIF test</h1>
      <p className="text-sm text-[#3D5C59]">
        Test each button with a photo that you know has location on. Allow location access when asked.
      </p>

      <label className={`${btn} bg-[#0E4C55]`}>
        1 · Pick from library (image/*)
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handle(e, "library image/*")} />
      </label>

      <label className={`${btn} bg-[#0E4C55]`}>
        2 · Pick from library (heic explicit)
        <input type="file" accept="image/heic,image/heif,image/jpeg,image/png" multiple className="hidden"
          onChange={(e) => handle(e, "library heic-explicit")} />
      </label>

      <label className={`${btn} bg-[#E8623F]`}>
        3 · Take a photo now (camera)
        <input type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => handle(e, "camera capture")} />
      </label>

      {busy && <p className="text-sm">Reading…</p>}

      {rows.length > 0 && (
        <>
          <button
            className="w-full rounded-2xl border border-[#E8623F] px-4 py-3 font-semibold text-[#E8623F]"
            onClick={() => navigator.clipboard.writeText(report())}
          >
            Copy report
          </button>

          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="rounded-2xl bg-white p-4 text-sm shadow">
                <p className="font-semibold">{r.path}</p>
                <p className="text-[#7E9895]">{r.name} · {r.type} · {r.sizeKB} KB</p>
                <p className="mt-2">
                  EXIF GPS: {r.lat !== null ? `✅ ${r.lat.toFixed(5)}, ${r.lng?.toFixed(5)}` : "❌ none"}
                </p>
                <p>Taken at: {r.takenAt ? `✅ ${r.takenAt}` : "❌ none"}</p>
                <p>Camera: {r.device ?? "—"}</p>
                <p>
                  Phone location now:{" "}
                  {r.deviceLat !== null ? `✅ ${r.deviceLat.toFixed(5)}, ${r.deviceLng?.toFixed(5)}` : "❌ denied / unavailable"}
                </p>
                {r.error && <p className="mt-1 text-[#C94A2C]">Error: {r.error}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
