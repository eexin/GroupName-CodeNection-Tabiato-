"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildPlan } from "@/features/planner/actions";
import Link from "next/link";
import { Ato } from "@/components/ato";

const STEPS = ["Locking in your must-visit places", "Looking up real places nearby", "Reading what you rated on past trips", "Ato is planning each day", "Fitting meals and walking time", "Checking every place is real"];

/** 31b Itinerary — generating. */
export function Building({ tripId, name, days }: { tripId: string; name: string; days: number }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    buildPlan(tripId).then((r) => {
      clearInterval(tick);
      if (r && "error" in r && r.error) setError(r.error);
      else { router.replace(`/plan/${tripId}`); router.refresh(); }
    });
    return () => clearInterval(tick);
  }, [tripId, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center bg-gradient-to-b from-[#17707a] to-deeper px-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="flex w-full justify-end"><Link href={`/plan/${tripId}`} className="min-h-[40px] content-center text-[13px] font-bold text-[#bfe4e0]">Cancel</Link></div>
      <div className="mt-12"><Ato size={140} /></div>
      <h1 className="mt-6 text-center text-[24px] font-bold leading-tight">Ato is planning<br /><span className="text-sand">{days} days in {name}</span></h1>
      <p className="mt-3 text-center text-[12.5px] text-[#8fbdb8]">Your must-visit places stay exactly where you put them.</p>
      {error ? <p role="alert" className="mt-8 rounded-[12px] bg-white/10 px-4 py-3 text-[12.5px]">{error}</p> : (
        <>
        <div className="mt-8 h-2 w-full rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(((step + 1) / STEPS.length) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 rounded-full bg-sand transition-all" style={{ width: `${Math.round(((step + 1) / STEPS.length) * 100)}%` }} />
        </div>
        <p className="mt-2 w-full text-right text-[11px] text-[#bfe4e0]">{Math.round(((step + 1) / STEPS.length) * 100)}%</p>
        <ol className="mt-4 w-full space-y-3.5">
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
