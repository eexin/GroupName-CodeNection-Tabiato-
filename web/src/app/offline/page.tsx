import { Ato } from "@/components/ato";

/** Shown by the service worker when the phone has no connection. Static: no data, no auth. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3 px-8 text-center">
      <Ato size={110} mood="rest" />
      <h1 className="text-[20px] font-bold text-ink">You&apos;re offline</h1>
      <p className="text-[13px] leading-relaxed text-body">Your trips are safe. Reconnect and pull down to refresh — photos you took meanwhile stay on your phone, ready to upload.</p>
    </main>
  );
}
