"use client";

import Link from "next/link";
import { useState } from "react";
import { Ato } from "@/components/ato";

const STEPS = [
  { title: "Your photos pin themselves", body: "Upload from your camera roll. I read where and when each shot was taken and drop it on the map for you.", mood: "open" as const },
  { title: "One map, everyone who was there", body: "Invite the people you travelled with. Their photos, spending and notes land on the same map, grouped by place.", mood: "happy" as const },
  { title: "Ato turns it into a story", body: "When the trip ends, I write a memory book from what you logged, and I remember your taste for the next trip.", mood: "happy" as const },
];

/** 04a–04c — shown once, straight after sign-up. */
export default function WelcomePage() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-gradient-to-b from-[#17707a] to-deeper px-6 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="flex justify-end">
        <Link href="/onboarding" className="text-[13px] font-bold text-[#8fbdb8]">Skip</Link>
      </div>
      <div className="mt-10 grid flex-1 place-items-center">
        <Ato size={200} mood={step.mood} />
      </div>
      <p className="text-center text-[10.5px] font-bold text-sand">Step {i + 1} of {STEPS.length}</p>
      <h1 className="mt-3 text-center text-[26px] font-bold leading-tight">{step.title}</h1>
      <p className="mx-auto mt-4 max-w-[300px] text-center text-[13px] leading-relaxed text-[#8fbdb8]">{step.body}</p>
      <div className="mt-8 flex justify-center gap-2" aria-hidden>
        {STEPS.map((_, j) => <span key={j} className={`h-2 rounded-full ${j === i ? "w-5 bg-white" : "w-2 bg-white/30"}`} />)}
      </div>
      {last ? (
        <Link href="/onboarding" className="mt-8 flex h-[52px] items-center justify-center rounded-[15px] bg-coral text-[15px] font-bold">Get started</Link>
      ) : (
        <button onClick={() => setI(i + 1)} className="mt-8 h-[52px] rounded-[15px] bg-coral text-[15px] font-bold">Next</button>
      )}
    </main>
  );
}
