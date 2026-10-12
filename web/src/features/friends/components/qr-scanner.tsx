"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { handleFromScan } from "@/features/friends/qr-parse";

/**
 * Figma 22c "Scan QR". Camera frames are decoded in the browser with jsQR, which works on
 * iPhone Safari as well as Android (it doesn't rely on the BarcodeDetector API Safari lacks).
 * Needs HTTPS and camera permission.
 */
export function QrScanner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream.current;
        await video.current.play();
        const { default: jsQR } = await import("jsqr");
        const tick = () => {
          if (stopped || !video.current || !ctx) return;
          const v = video.current;
          if (v.videoWidth) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            const handle = code ? handleFromScan(code.data) : null;
            if (handle) { stopped = true; close(); router.push(`/u/${handle}`); return; }
            if (code) setMessage("That code isn't a Tabiato friend link.");
          }
          timer = setTimeout(tick, 200);
        };
        tick();
      } catch {
        setMessage("Allow camera access to scan, or ask your friend for their link instead.");
      }
    })();

    return () => { stopped = true; clearTimeout(timer); stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [open, router]);

  function close() {
    stream.current?.getTracks().forEach((t) => t.stop());
    setOpen(false);
    setMessage(null);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full flex-col rounded-[18px] bg-card p-4 text-left shadow-card">
        <span className="text-[13px] font-bold text-ink">Scan QR</span>
        <span className="mt-0.5 text-[10.5px] text-muted">Point at their code</span>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Scan a friend's QR code" className="fixed inset-0 z-50 flex flex-col bg-[#0a2226]">
          <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] text-white">
            <span className="text-[14px] font-bold">Scan a friend&apos;s code</span>
            <button onClick={close} aria-label="Close scanner" className="grid h-10 w-10 place-items-center text-[22px]">×</button>
          </div>
          <div className="relative flex flex-1 items-center justify-center">
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
            <div aria-hidden className="pointer-events-none absolute h-60 w-60 rounded-[24px] border-4 border-white/80" />
          </div>
          <p role="status" className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-center text-[12.5px] text-[#bfe4e0]">
            {message ?? "Hold the code inside the square."}
          </p>
        </div>
      )}
    </>
  );
}
