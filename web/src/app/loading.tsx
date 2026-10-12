import { Ato } from "@/components/ato";

/** Shown while a server page is loading, so a tap always gives immediate feedback. */
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <div className="animate-pulse"><Ato size={72} /></div>
      <p className="text-[12.5px] text-muted">Loading…</p>
    </main>
  );
}
