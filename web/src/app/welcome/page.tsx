import { nextQuery } from "@/lib/safe-next";
import { WelcomeSteps } from "./steps";

/** 04a–04c. Carries ?next (an invite link, say) on to profile setup. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <WelcomeSteps onboarding={`/onboarding${nextQuery((await searchParams).next)}`} />;
}
