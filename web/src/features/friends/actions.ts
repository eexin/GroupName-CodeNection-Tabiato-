"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/guards";
import type { ActionResult } from "@/lib/types";
import { redirect } from "next/navigation";
import { isDemoEmail } from "@/features/auth/demo";

export async function sendFriendRequest(addressee: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (addressee === user.id) return { error: "That's you." };
  const { error } = await supabase.from("friendships").insert({ requester: user.id, addressee, status: "pending" });
  revalidatePath("/friends");
  revalidatePath("/u/[username]", "page");
  if (error?.code === "23505") return { error: "Request already sent." };
  return error ? { error: "Couldn't send the request." } : { ok: true };
}

export async function respondToFriend(requester: string, accept: boolean) {
  const { supabase, user } = await requireUser();
  if (accept) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("requester", requester).eq("addressee", user.id);
  } else {
    await supabase.from("friendships").delete().eq("requester", requester).eq("addressee", user.id);
  }
  revalidatePath("/friends");
  revalidatePath("/u/[username]", "page");
}

export async function removeFriend(other: string) {
  const { supabase, user } = await requireUser();
  if (isDemoEmail(user.email)) redirect("/friends?locked=1");
  await supabase.from("friendships").delete().or(
    `and(requester.eq.${user.id},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${user.id})`,
  );
  revalidatePath("/friends");
  revalidatePath("/u/[username]", "page");
}
