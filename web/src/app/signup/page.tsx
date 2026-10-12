import { GoogleButton } from "@/features/auth/components/google-button";
import { SignupForm } from "./form";

export default function SignupPage() {
  return <SignupForm google={<GoogleButton />} />;
}
