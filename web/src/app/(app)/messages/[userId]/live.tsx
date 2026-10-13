"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { markRead, sendMessage } from "@/features/community/actions";
import type { ActionResult } from "@/lib/types";

/** Keeps the thread fresh (every 5 s while visible), marks it read, and sends. */
export function ThreadLive({ other }: { other: string }) {
  const router = useRouter();
  const [state, action, busy] = useActionState<ActionResult, FormData>(sendMessage.bind(null, other), {});
  useEffect(() => {
    markRead(other);
    const t = setInterval(() => { if (document.visibilityState === "visible") { router.refresh(); markRead(other); } }, 5000);
    return () => clearInterval(t);
  }, [other, router]);
  return (
    <form action={action} className="fixed inset-x-0 bottom-0 mx-auto max-w-[430px] lg:sticky lg:max-w-none border-t border-line bg-paper px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      {state.error && <p role="alert" className="mb-2 text-[11.5px] text-coral-dark">{state.error}</p>}
      <div className="flex items-center gap-2 rounded-full bg-card py-1.5 pl-4 pr-1.5 shadow-card">
        <input name="body" placeholder="Write a message" aria-label="Message" maxLength={2000} required className="h-9 flex-1 bg-transparent text-[13.5px] placeholder:text-muted focus:outline-none" />
        <button disabled={busy} className="h-9 shrink-0 rounded-full bg-coral px-4 text-[12px] font-bold text-white">Send</button>
      </div>
    </form>
  );
}
