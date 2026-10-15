"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/features/auth/actions";
import { Ato } from "@/components/ato";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/submit";

/** Opened from the reset email (the link signs you in first, via /auth/callback). */
export default function ResetPasswordPage() {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] wide:pt-20">
      <div className="flex justify-end"><Ato size={84} mood="happy" /></div>
      <h1 className="mt-4 text-[27px] font-bold text-ink">Choose a new password</h1>
      <form action={action} className="mt-8 space-y-4">
        <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
        <FormMessage error={state.error} message={state.message} />
        <Submit pending="Saving…">Save password</Submit>
      </form>
    </main>
  );
}
