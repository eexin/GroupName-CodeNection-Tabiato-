"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/features/auth/actions";
import { Ato } from "@/components/ato";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] lg:pt-20">
      <div className="flex justify-end"><Ato size={84} mood="rest" /></div>
      <h1 className="mt-4 text-[27px] font-bold text-ink">Forgot your password?</h1>
      <p className="mt-1 text-[13.5px] text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <form action={action} className="mt-8 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <FormMessage error={state.error} message={state.message} />
        <Submit pending="Sending…">Send reset link</Submit>
      </form>
      <p className="mt-10 text-center text-[12.5px] text-muted"><Link href="/login" className="font-bold text-coral">Back to log in</Link></p>
    </main>
  );
}
