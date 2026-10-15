"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { rescheduleAroundHazard } from "@/features/live/actions";
import { Ato } from "@/components/ato";

const STEPS = ["Finding the stops the alert affects", "Looking for a day that's all indoors", "Swapping the days", "Keeping your must-visits exactly where they were"];

/** 31b (rerouting variant) — "Ato is rerouting…" */
export function Rerouting({ tripId, tripName, daysLeft }: { tripId: string; tripName: string; daysLeft: number }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    rescheduleAroundHazard(tripId).then((r) => {
      clearInterval(tick);
      if ("from" in r) router.replace(`/trips/${tripId}?rescheduled=${r.from}-${r.to}`);
      else setError(r.error);
    });
    return () => clearInterval(tick);
  }, [tripId, router]);
  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-gradient-to-b from-[#17707a] to-deeper px-8 pb-10 wide:max-w-none wide:px-[max(2rem,calc(50%-240px))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="flex justify-end"><Link href={`/trips/${tripId}`} className="min-h-[40px] content-center text-[13px] font-bold text-[#bfe4e0]">Cancel</Link></div>
      <div className="mt-12 flex flex-col items-center">
        <Ato size={140} />
        <h1 className="mt-6 text-center text-[24px] font-bold leading-tight">Ato is rerouting…<br /><span className="text-sand">your {daysLeft} day{daysLeft === 1 ? "" : "s"} in {tripName}</span></h1>
        <p className="mt-3 text-center text-[12.5px] text-[#bfe4e0]">Your must-visit places stay exactly where you put them.</p>
      </div>
      {error ? <p role="alert" className="mt-8 rounded-[12px] bg-white/10 px-4 py-3 text-[12.5px]">{error}</p> : (
        <>
          <div className="mt-8 h-2 rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 rounded-full bg-sand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-right text-[11px] text-[#bfe4e0]">{pct}%</p>
          <ol className="mt-4 space-y-3.5">
            {STEPS.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 text-[13px] ${i <= step ? "text-white" : "text-[#8fbdb8]"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i < step ? "bg-sand text-deeper" : i === step ? "border-2 border-sand" : "bg-white/15"}`}>{i < step ? "✓" : ""}</span>
                {s}
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
