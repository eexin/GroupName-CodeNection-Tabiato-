"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/guards";
import { geocodeDestination } from "@/features/planner/osm";
import { audienceFields, type ActionResult, type Audience } from "@/lib/types";
import { isDemoEmail } from "@/features/auth/demo";

export type TripState = { error?: string };

const tripSchema = z
  .object({
    name: z.string().trim().min(1, "Give the trip a name.").max(60),
    destination: z.string().trim().max(80).optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    is_public: z.boolean(),
    friends_can_view: z.boolean(),
    budget: z.coerce.number({ message: "Enter the budget in RM, like 3000." }).min(0).max(10_000_000).nullable(),
  })
  .refine((t) => !t.start_date || !t.end_date || t.end_date >= t.start_date, {
    message: "The end date is before the start date.",
  });

/** "Budget for the whole trip": empty means none; "3,000" means 3000. */
function budgetFrom(form: FormData) {
  const raw = String(form.get("budget") ?? "").replace(/,/g, "").trim();
  return raw === "" ? null : raw;
}

/** "audience" from the form (private, friends or public); the old "Share to Community" switch still works. */
function audienceFrom(form: FormData): Audience {
  const a = String(form.get("audience") ?? "");
  if (a === "private" || a === "friends" || a === "public") return a;
  return form.get("is_public") === "on" ? "public" : "private";
}

/** The role a new invitee gets, from the owner's "Let friends add to my trips" switch. */
async function inviteRole(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], ownerId: string) {
  const { data } = await supabase.from("profiles").select("settings").eq("id", ownerId).single();
  return data?.settings?.friends_can_add === false ? "viewer" : "contributor";
}

export type CreateResult = { error?: string; id?: string };

/** Figma 16 — returns the new id so the client can upload a cover, then navigates itself. */
export async function createTripForm(_: CreateResult, form: FormData): Promise<CreateResult> {
  const parsed = tripSchema.safeParse({
    name: form.get("name"),
    destination: form.get("destination") || undefined,
    start_date: form.get("start_date") || undefined,
    end_date: form.get("end_date") || undefined,
    budget: budgetFrom(form),
    ...audienceFields(audienceFrom(form)),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const where = parsed.data.destination ? await geocodeDestination(parsed.data.destination) : null;
  const { data, error } = await supabase
    .from("trips")
    .insert({
      ...parsed.data, owner_id: user.id, status: "ongoing",
      dest_lat: where?.lat ?? null, dest_lng: where?.lng ?? null, country_code: where?.countryCode ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create the trip. Try again." };
  const friends = form.getAll("friends").map(String).filter(Boolean);
  if (friends.length) {
    const role = await inviteRole(supabase, user.id);
    await supabase.from("trip_members").insert(friends.map((f) => ({ trip_id: data.id, user_id: f, role, status: "invited", invited_by: user.id })));
  }
  revalidatePath("/");
  return { id: data.id };
}

/** Edit trip — name, destination, dates, visibility. Owner only. */
export async function updateTrip(tripId: string, _: CreateResult, form: FormData): Promise<CreateResult> {
  const parsed = tripSchema.safeParse({
    name: form.get("name"),
    destination: form.get("destination") || undefined,
    start_date: form.get("start_date") || undefined,
    end_date: form.get("end_date") || undefined,
    budget: budgetFrom(form),
    ...audienceFields(audienceFrom(form)),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { data: old } = await supabase.from("trips").select("destination, owner_id").eq("id", tripId).single();
  if (old?.owner_id !== user.id) return { error: "Only the trip owner can edit it." };
  const moved = (parsed.data.destination ?? "") !== (old.destination ?? "");
  const where = moved && parsed.data.destination ? await geocodeDestination(parsed.data.destination) : null;
  const { error } = await supabase.from("trips").update({
    ...parsed.data,
    ...(moved ? { dest_lat: where?.lat ?? null, dest_lng: where?.lng ?? null, country_code: where?.countryCode ?? null } : {}),
  }).eq("id", tripId);
  if (error) return { error: "Couldn't save. Try again." };
  const friends = form.getAll("friends").map(String).filter(Boolean);
  if (friends.length) {
    const role = await inviteRole(supabase, user.id);
    await supabase.from("trip_members").upsert(
      friends.map((f) => ({ trip_id: tripId, user_id: f, role, status: "invited", invited_by: user.id })),
      { onConflict: "trip_id,user_id", ignoreDuplicates: true },
    );
  }
  revalidatePath(`/trips/${tripId}`);
  return { id: tripId };
}

/** Called by the client after it uploads the cover image to storage. */
export async function setCover(tripId: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!path.startsWith(`${tripId}/cover-`)) return;
  await supabase.from("trips").update({ cover_path: path }).eq("id", tripId).eq("owner_id", user.id);
  revalidatePath("/");
}

export async function setMemberRole(tripId: string, userId: string, role: "contributor" | "viewer") {
  const { supabase } = await requireUser();
  await supabase.from("trip_members").update({ role }).eq("trip_id", tripId).eq("user_id", userId);
  revalidatePath(`/trips/${tripId}/members`);
}

export async function createTrip(_: TripState, form: FormData): Promise<TripState> {
  const parsed = tripSchema.safeParse({
    name: form.get("name"),
    destination: form.get("destination") || undefined,
    start_date: form.get("start_date") || undefined,
    end_date: form.get("end_date") || undefined,
    budget: budgetFrom(form),
    ...audienceFields(audienceFrom(form)),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  // best effort: a destination lets the trip show weather, alerts and intel
  const where = parsed.data.destination ? await geocodeDestination(parsed.data.destination) : null;
  const { data, error } = await supabase
    .from("trips")
    .insert({
      ...parsed.data, owner_id: user.id, status: "ongoing",
      dest_lat: where?.lat ?? null, dest_lng: where?.lng ?? null, country_code: where?.countryCode ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create the trip. Try again." };
  revalidatePath("/");
  redirect(`/trips/${data.id}`);
}

export async function endTrip(tripId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("trips").update({ status: "finished" }).eq("id", tripId).eq("owner_id", user.id);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}/book`);
}

/** Who can see the trip: only its people, the owner's friends too, or everyone (Community). */
export async function setTripAudience(tripId: string, audience: Audience): Promise<ActionResult> {
  if (!["private", "friends", "public"].includes(audience)) return { error: "Unknown choice." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("trips").update(audienceFields(audience)).eq("id", tripId).eq("owner_id", user.id);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/share`);
  return error ? { error: "Only the trip owner can change this." } : { ok: true };
}

const SHAREABLE = ["photos", "ratings", "comments", "spend"] as const;
export type ShareField = (typeof SHAREABLE)[number];

/** Figma 36a — switch one part of a public trip on or off. Enforced by RLS, not just hidden. */
export async function setShareField(tripId: string, field: ShareField, on: boolean) {
  if (!SHAREABLE.includes(field)) return;
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("trips").select("share_settings").eq("id", tripId).eq("owner_id", user.id).maybeSingle();
  if (!data) return;
  await supabase.from("trips").update({ share_settings: { ...(data.share_settings ?? {}), [field]: on } }).eq("id", tripId).eq("owner_id", user.id);
  revalidatePath(`/trips/${tripId}/options`);
}

export async function deleteTrip(tripId: string) {
  const { supabase, user } = await requireUser();
  if (isDemoEmail(user.email)) redirect(`/trips/${tripId}/options?locked=1`);
  const { data: trip } = await supabase.from("trips").select("owner_id").eq("id", tripId).maybeSingle();
  if (trip?.owner_id !== user.id) redirect(`/trips/${tripId}`);
  // remove the photo files too — otherwise they stay in storage with nothing pointing at them
  for (;;) {
    const { data: files } = await supabase.storage.from("photos").list(tripId, { limit: 100 });
    if (!files?.length) break;
    const { error } = await supabase.storage.from("photos").remove(files.map((f) => `${tripId}/${f.name}`));
    if (error) break;
  }
  await supabase.from("trips").delete().eq("id", tripId).eq("owner_id", user.id);
  revalidatePath("/");
  redirect("/trips");
}

export async function inviteToTrip(tripId: string, userId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("trip_members")
    .insert({ trip_id: tripId, user_id: userId, role: await inviteRole(supabase, user.id), status: "invited", invited_by: user.id });
  revalidatePath(`/trips/${tripId}/members`);
  if (error?.code === "23505") return { error: "Already invited." };
  return error ? { error: "Only the trip owner can invite people." } : { ok: true };
}

export async function respondToInvite(tripId: string, accept: boolean) {
  const { supabase, user } = await requireUser();
  if (accept) {
    await supabase.from("trip_members").update({ status: "joined" }).eq("trip_id", tripId).eq("user_id", user.id);
  } else {
    await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", user.id);
  }
  revalidatePath("/");
  if (accept) redirect(`/trips/${tripId}`);
}

/** Leaving keeps the group's record whole by default; the leaver may take their own photos with them. */
export async function leaveTrip(tripId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (isDemoEmail(user.email)) redirect(`/trips/${tripId}/members?locked=1`);
  if (form.get("remove_photos") === "on") {
    const { data: mine } = await supabase.from("photos").select("id, storage_path, place_id").eq("trip_id", tripId).eq("uploaded_by", user.id);
    const rows = mine ?? [];
    if (rows.length) {
      await supabase.storage.from("photos").remove(rows.map((r) => r.storage_path));
      await supabase.from("photos").delete().in("id", rows.map((r) => r.id));
      // places that now have no photos at all would be empty pins on everyone's map
      const touched = [...new Set(rows.map((r) => r.place_id).filter(Boolean))] as string[];
      if (touched.length) {
        // one query for the survivors, instead of a count per place
        const { data: left } = await supabase.from("photos").select("place_id").in("place_id", touched);
        const keep = new Set((left ?? []).map((r) => r.place_id));
        const empty = touched.filter((id) => !keep.has(id));
        if (empty.length) await supabase.from("places").delete().in("id", empty);
      }
    }
  }
  await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", user.id);
  revalidatePath("/");
  redirect("/trips");
}

export async function removeMember(tripId: string, userId: string) {
  const { supabase, user } = await requireUser();
  if (isDemoEmail(user.email)) redirect(`/trips/${tripId}/members?locked=1`);
  await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", userId);
  revalidatePath(`/trips/${tripId}/members`);
  if (userId === user.id) redirect("/trips");
}

/** Figma 21 "Remind" — nudges someone who hasn't accepted yet, as an in-app message. */
export async function remindInvite(tripId: string, userId: string) {
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("name, owner_id").eq("id", tripId).single();
  if (trip?.owner_id !== user.id) redirect(`/trips/${tripId}/members`);
  await supabase.from("messages").insert({
    sender: user.id, recipient: userId,
    body: `Reminder: I invited you to ${trip.name} on Tabiato. The invite is at the top of your Home screen.`,
  });
  redirect(`/trips/${tripId}/members?reminded=${userId}`);
}
