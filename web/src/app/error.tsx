"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Ato } from "@/components/ato";

/** Any unexpected error below the root layout lands here instead of a blank framework page. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // report it so it shows up in the deployment logs (see /api/client-error)
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3 px-8 text-center">
      <Ato size={100} mood="rest" />
      <h1 className="text-[20px] font-bold text-ink">Something went wrong</h1>
      <p className="text-[13px] leading-relaxed text-body">
        That didn&apos;t load. It&apos;s usually a dropped connection — try again.
      </p>
      {error.digest && <p className="text-[11px] text-muted">Reference: {error.digest}</p>}
      <button onClick={() => retry()} className="mt-2 h-12 w-full max-w-[240px] rounded-[15px] bg-coral text-[14px] font-bold text-white">Try again</button>
      <Link href="/" className="py-2 text-[13px] font-bold text-muted">Go to my map</Link>
    </main>
  );
}
