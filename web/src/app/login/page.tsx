import { demoEnabled } from "@/features/auth/demo";
import { GoogleButton } from "@/features/auth/components/google-button";
import { LoginForm } from "./form";

/** Rendered on the server so the form is in the HTML immediately; ?next survives the login. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string; oauth?: string }> }) {
  const { next, demo, oauth } = await searchParams;
  return <LoginForm next={next ?? ""} demo={demoEnabled()} demoError={demo === "unavailable"} oauthFailed={oauth === "failed"} google={<GoogleButton next={next ?? ""} />} />;
}
