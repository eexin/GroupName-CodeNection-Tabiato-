"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/guards";

export type ProfileState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Add the name your friends will see.").max(40),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Usernames are 3–24 letters, numbers or underscores."),
  budget: z.enum(["budget", "mid", "luxury"]),
  pace: z.enum(["slow", "balanced", "packed"]),
  interests: z.array(z.string()).max(8),
});

export async function saveProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const parsed = schema.safeParse({
    name: form.get("name"),
    username: form.get("username"),
    budget: form.get("budget"),
    pace: form.get("pace"),
    interests: form.getAll("interests"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { name, username, ...style } = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name, username, travel_style: style, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error?.code === "23505") return { error: `@${username} is taken. Try another.` };
  if (error) return { error: "Couldn't save your profile. Try again." };
  redirect("/");
}
