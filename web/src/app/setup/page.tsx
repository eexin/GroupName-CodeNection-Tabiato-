import Link from "next/link";
import { Ato } from "@/components/ato";
import { hasSupabase } from "@/lib/supabase/env";

/** Shown when the Supabase environment variables are missing. */
export default function SetupPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] px-6 py-10">
      <Ato size={90} mood="rest" />
      <h1 className="mt-4 text-[22px] font-bold text-ink">{hasSupabase ? "You're connected" : "Connect Supabase"}</h1>
      {hasSupabase ? (
        <Link href="/" className="mt-6 inline-block font-bold text-coral">Open the app</Link>
      ) : (
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-[13px] leading-relaxed text-body">
          <li>Create a project at supabase.com.</li>
          <li>SQL Editor → paste <code className="text-ink">supabase/schema.sql</code> → Run.</li>
          <li>Authentication → Sign In / Providers → Email: turn <strong>Confirm email</strong> off for the hackathon.</li>
          <li>Copy <code className="text-ink">web/.env.example</code> to <code className="text-ink">web/.env.local</code> and fill in the URL and anon key from Project Settings → API.</li>
          <li>Restart <code className="text-ink">npm run dev</code>. On Vercel, add the same variables and redeploy.</li>
        </ol>
      )}
    </main>
  );
}
