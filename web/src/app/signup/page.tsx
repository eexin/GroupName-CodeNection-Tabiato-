import { GoogleButton } from "@/features/auth/components/google-button";
import { safeNext } from "@/lib/safe-next";
import { SignupForm } from "./form";

/** ?next (an invite link, say) survives sign-up, the welcome screens and profile setup. */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return <SignupForm next={next} google={<GoogleButton next={next} />} />;
}
