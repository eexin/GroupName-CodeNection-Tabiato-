"use client";

import Link from "next/link";
import { nextQuery } from "@/lib/safe-next";
import { useActionState } from "react";
import { signIn, signInDemo, type AuthState } from "@/features/auth/actions";
import { Ato } from "@/components/ato";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";

export function LoginForm({ next, demo, demoError, oauthFailed, google }: { next: string; demo: boolean; demoError: boolean; oauthFailed: boolean; google: React.ReactNode }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <main className="min-h-dvh wide:grid wide:grid-cols-2">
      {/* desktop: the pitch on the left — phones go straight to the form */}
      <section className="hidden flex-col justify-center bg-gradient-to-br from-[#17707a] to-deeper px-16 text-white wide:flex">
        <Ato size={140} />
        <h1 className="mt-6 text-[40px] font-bold leading-tight">Tabiato <span className="text-[30px] font-normal text-[#f9ae8c]">旅跡</span></h1>
        <p className="mt-3 max-w-md text-[17px] leading-relaxed text-[#bfe4e0]">Where a trip goes after it ends. One shared map of the places you went, and a memory book Ato writes from it.</p>
        <p className="mt-8 max-w-md rounded-[16px] bg-white/10 px-5 py-4 text-[13px] leading-relaxed text-[#e2eeec]">
          Tabiato is built for your phone — that&apos;s where trips happen. Open this page on your phone and add it to your home screen for the full app.
        </p>
      </section>

      <div className="mx-auto w-full max-w-[430px] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] wide:flex wide:flex-col wide:justify-center wide:pt-0">
        <div className="flex justify-end wide:hidden"><Ato size={84} /></div>
        <h2 className="mt-4 text-[27px] font-bold text-ink">Welcome back</h2>
        <p className="mt-1 text-[13.5px] text-muted">Your memories are waiting.</p>

        {demo && (
          <form action={signInDemo} className="mt-6">
            <button className="flex h-[56px] w-full flex-col items-center justify-center rounded-[16px] bg-deep text-white">
              <span className="text-[15px] font-bold">Explore a sample account</span>
              <span className="text-[11px] text-[#bfe4e0]">Trips, photos and a memory book already in it — no sign-up</span>
            </button>
          </form>
        )}
        {demoError && <p role="alert" className="mt-3 text-[12px] text-coral-dark">The sample account is being refreshed. Try again in a minute.</p>}
        {demo && <p className="my-5 text-center text-[11px] text-muted">or log in</p>}

        <form action={action} className={`${demo ? "" : "mt-8"} space-y-4`}>
          <input type="hidden" name="next" value={next} />
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          <div className="-mt-2 text-right"><Link href="/forgot-password" className="inline-block min-h-[32px] text-[12px] font-bold text-coral">Forgot password?</Link></div>
          <FormMessage error={state.error} message={state.message} />
          <Submit pending="Logging in…">Log in</Submit>
        </form>
        {google && <div className="mt-4">{google}</div>}
        {oauthFailed && <p role="alert" className="mt-3 text-center text-[12px] text-coral-dark">That sign-in didn&apos;t finish. Try again, or use your email.</p>}
        <p className="mt-10 text-center text-[12.5px] text-muted">
          New to Tabiato?{" "}
          <Link href={`/signup${nextQuery(next)}`} className="font-bold text-coral">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
