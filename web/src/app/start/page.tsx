import Link from "next/link";
import { Ato } from "@/components/ato";
import { demoEnabled } from "@/features/auth/demo";
import { signInDemo } from "@/features/auth/actions";

/** Figma 01 Splash — the first thing a signed-out visitor sees. */
export default function StartPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-between bg-gradient-to-b from-[#17707a] to-deeper px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] text-center text-white">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Ato size={180} />
        <h1 className="mt-6 text-[40px] font-bold leading-none">Tabiato <span className="text-[30px] font-normal text-[#f9ae8c]">旅跡</span></h1>
        <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-[#bfe4e0]">Where a trip goes after it ends.</p>
      </div>
      <div className="w-full max-w-[360px] space-y-3">
        <Link href="/signup" className="flex h-[54px] items-center justify-center rounded-[16px] bg-coral text-[16px] font-bold">Get Started</Link>
        <Link href="/login" className="flex h-[48px] items-center justify-center rounded-[16px] bg-white/10 text-[14px] font-bold">I already have an account</Link>
        {demoEnabled() && (
          <form action={signInDemo}><button className="h-[44px] w-full text-[13px] font-bold text-[#bfe4e0] underline-offset-4 hover:underline">Explore a sample account</button></form>
        )}
        <p className="pt-2 text-[11px] text-[#8fbdb8]">Made for your phone — add it to your home screen.</p>
      </div>
    </main>
  );
}
