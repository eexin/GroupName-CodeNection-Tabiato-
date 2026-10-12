"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { generateMemoryBook } from "@/features/memory-book/actions";
import { Ato } from "@/components/ato";

const STEPS = ["Reading your photos", "Grouping them by place and day", "Found what you kept coming back to", "Choosing the highlights", "Writing the pages"];

/** 25b Memory book — generating. Starts the job on mount, then shows the finished book. */
export function Generating({ tripId, tripName }: { tripId: string; tripName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1600);
    generateMemoryBook(tripId).then((r) => {
      clearInterval(tick);
      if (r && "error" in r && r.error) setError(r.error);
      else router.refresh();
    });
    return () => clearInterval(tick);
  }, [tripId, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center bg-gradient-to-b from-[#17707a] to-deeper px-8 pt-24 text-white">
      <Ato size={150} />
      <h1 className="mt-6 text-center text-[24px] font-bold leading-tight">I&apos;m writing<br /><span className="text-sand">{tripName}</span></h1>
      <p className="mt-3 text-center text-[12.5px] text-[#8fbdb8]">This takes a few seconds.</p>
      {error ? (
        <p role="alert" className="mt-8 rounded-[12px] bg-white/10 px-4 py-3 text-[12.5px]">{error}</p>
      ) : (
        <ol className="mt-10 w-full space-y-3.5">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 text-[13px] ${i <= step ? "text-white" : "text-[#8fbdb8]"}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i < step ? "bg-sand text-deeper" : i === step ? "border-2 border-sand" : "bg-white/15"}`}>
                {i < step ? "✓" : ""}
              </span>
              {s}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
