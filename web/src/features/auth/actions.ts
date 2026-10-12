"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { origin } from "@/lib/origin";
import { isDemoEmail } from "@/features/auth/demo";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const creds = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password."),
});

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "That email and password don't match an account." };
  redirect(safeNext(String(form.get("next") ?? "")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (form.get("password") !== form.get("confirm")) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: error.message };
  // with "Confirm email" switched on in Supabase there is no session until they click the link
  if (!data.session) return { message: "Check your email and open the link to finish signing up." };
  redirect("/welcome");
}

/** "Try the demo" — signs straight into the shared demo account (credentials stay on the server). */
export async function signInDemo() {
  const email = process.env.DEMO_EMAIL, password = process.env.DEMO_PASSWORD;
  if (!email || !password) redirect("/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  redirect(error ? "/login?demo=unavailable" : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Continue with Google (Supabase OAuth). New Google users go through the same welcome and profile setup. */
export async function signInWithGoogle(form: FormData) {
  const next = safeNext(String(form.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?oauth=failed");
  redirect(data.url);
}

/** Forgot password — always the same answer, so nobody can probe which emails have accounts. */
export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.email("Enter a valid email address.").safeParse(form.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (isDemoEmail(parsed.data)) return { error: "The sample account's password can't be reset." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  return { message: "If that email has an account, a reset link is on its way. Check your inbox and spam folder." };
}

/** The page the email link opens: choose a new password. */
export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (password !== form.get("confirm")) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "That reset link has expired. Ask for a new one." };
  if (isDemoEmail(data.user.email)) return { error: "The sample account's password can't be changed." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/");
}
