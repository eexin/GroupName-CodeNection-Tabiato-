import Link from "next/link";
import { Ato } from "@/components/ato";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3 px-8 text-center">
      <Ato size={100} mood="rest" />
      <h1 className="text-[20px] font-bold text-ink">Nothing here</h1>
      <p className="text-[13px] leading-relaxed text-body">This page doesn&apos;t exist, or the trip was deleted.</p>
      <Link href="/" className="mt-2 flex h-12 w-full max-w-[240px] items-center justify-center rounded-[15px] bg-coral text-[14px] font-bold text-white">Go to my map</Link>
    </main>
  );
}
