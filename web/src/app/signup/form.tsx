"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthState } from "@/features/auth/actions";
import { Ato } from "@/components/ato";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";

export function SignupForm({ google }: { google: React.ReactNode }) {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex justify-end"><Ato size={84} mood="happy" /></div>
      <h1 className="mt-4 text-[27px] font-bold text-ink">Create account</h1>
      <p className="mt-1 text-[13.5px] text-muted">Start collecting your trips.</p>
      <form action={action} className="mt-8 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
        <FormMessage error={state.error} message={state.message} />
        <Submit pending="Creating your account…">Sign up</Submit>
      </form>
      {google && <div className="mt-4">{google}</div>}
      <p className="mt-10 text-center text-[12.5px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-coral">Log in</Link>
      </p>
    </main>
  );
}
