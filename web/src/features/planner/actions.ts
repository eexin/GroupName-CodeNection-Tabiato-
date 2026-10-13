"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiJSON } from "@/lib/ai";
import { requireUser } from "@/features/auth/guards";
import { categorise } from "@/lib/categories";
import { askAtoForPlaces, checkNamedPlaces, geocodeDestination, mapPlacesIn, nearbyPois, POI_BUDGET, suggestCities } from "@/features/planner/osm";
import { isTooBig } from "@/features/planner/destination";
import { STAYS_SYSTEM, applyStays, boxAround, budgetTier, eatsNearStops, rankStays, staysPrompt, staysSchema, type MapPlace } from "@/features/planner/stays";
import { buildItinerary, type Pace, type Scheduled, type UserStop } from "@/features/planner/itinerary";
import { AI_PLAN_SYSTEM, aiPlanPrompt, aiPlanSchema, applyAiPlan, perDayRange, shortlist } from "@/features/planner/ai-plan";
import { learnForUser } from "@/features/planner/learn";
import type { ActionResult } from "@/lib/types";

export type PlanValues = { destination: string; start_date: string; end_date: string; budget: string; pace: string; interests: string[] };
/** `ask`: the destination was a whole country or region; Ato offers real cities in it. */
export type PlanState = { error?: string; ask?: { area: string; cities: string[] }; values?: PlanValues; n?: number };

const planSchema = z
  .object({
    destination: z.string().trim().min(2, "Where are you going?").max(80),
    start_date: z.string().min(1, "Pick a start date."),
    end_date: z.string().min(1, "Pick an end date."),
    budget: z.coerce.number().min(0).max(1_000_000).optional(),
    pace: z.enum(["slow", "balanced", "packed"]),
    interests: z.array(z.string()).max(8),
  })
  .refine((p) => p.end_date >= p.start_date, { message: "The end date is before the start date." })
  .refine((p) => (new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / 86400000 < 14, { message: "Plans are limited to 14 days." });

/** 29 Plan a trip → creates a trip in 'planned' status. */
export async function createPlan(prev: PlanState, form: FormData): Promise<PlanState> {
  // a city button from Ato's question submits the form with its own value
  const picked = String(form.get("destination_pick") ?? "").trim();
  const values: PlanValues = {
    destination: picked || String(form.get("destination") ?? ""),
    start_date: String(form.get("start_date") ?? ""), end_date: String(form.get("end_date") ?? ""),
    budget: String(form.get("budget") ?? ""), pace: String(form.get("pace") ?? "balanced"),
    interests: form.getAll("interests").map(String),
  };
  // the form is redrawn with what was typed, so an error or a question never clears it
  const back = (s: PlanState): PlanState => ({ ...s, values, n: (prev.n ?? 0) + 1 });
  const parsed = planSchema.safeParse({
    destination: values.destination,
    start_date: form.get("start_date"),
    end_date: form.get("end_date"),
    budget: form.get("budget") || undefined,
    pace: form.get("pace"),
    interests: form.getAll("interests"),
  });
  if (!parsed.success) return back({ error: parsed.error.issues[0].message });
  const where = await geocodeDestination(parsed.data.destination);
  if (!where) return back({ error: `I couldn't find "${parsed.data.destination}" on the map. Try a city name.` });
  // a country or a big island: its centre is nowhere useful, so ask which city instead
  if (isTooBig(where.kind, where.km) && where.box) {
    const cities = await suggestCities({ name: where.name, countryCode: where.countryCode, box: where.box });
    return back({ ask: { area: where.name, cities } });
  }

  const { supabase, user } = await requireUser();
  const { destination, start_date, end_date, budget, pace, interests } = parsed.data;
  const { data, error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id, name: destination.split(",")[0], destination, start_date, end_date, status: "planned",
      dest_lat: where.lat, dest_lng: where.lng, country_code: where.countryCode, budget: budget ?? null, plan_style: { pace, interests },
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create the plan. Try again." };
  redirect(`/plan/${data.id}/places`);
}

const updateSchema = z
  .object({
    start_date: z.string().min(1, "Pick a start date."),
    end_date: z.string().min(1, "Pick an end date."),
    budget: z.coerce.number().min(0).max(1_000_000).optional(),
    pace: z.enum(["slow", "balanced", "packed"]),
    interests: z.array(z.string()).max(8),
  })
  .refine((p) => p.end_date >= p.start_date, { message: "The end date is before the start date." });

/** Figma 29 for an existing plan — change dates, budget and preferences, then regenerate. */
export async function updatePlan(tripId: string, _: PlanState, form: FormData): Promise<PlanState> {
  const parsed = updateSchema.safeParse({
    start_date: form.get("start_date"), end_date: form.get("end_date"),
    budget: form.get("budget") || undefined, pace: form.get("pace"), interests: form.getAll("interests"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("plan_style, owner_id").eq("id", tripId).single();
  if (trip?.owner_id !== user.id) return { error: "Only the trip leader can change the plan." };
  const { start_date, end_date, budget, pace, interests } = parsed.data;
  await supabase.from("trips").update({ start_date, end_date, budget: budget ?? null, plan_style: { ...(trip.plan_style ?? {}), pace, interests } }).eq("id", tripId);
  revalidatePath(`/plan/${tripId}`);
  redirect(`/plan/${tripId}/build`);
}

export async function addStop(tripId: string, stop: { name: string; lat: number; lng: number; category?: string | null; ref?: string }): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data: last } = await supabase.from("plan_stops").select("priority").eq("trip_id", tripId).eq("source", "user")
    .order("priority", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("plan_stops").insert({
    priority: (last?.priority ?? -1) + 1,
    trip_id: tripId, added_by: user.id, name: stop.name.slice(0, 120), lat: stop.lat, lng: stop.lng,
    category: stop.category ?? categorise(null, null), source: "user", osm_ref: stop.ref ?? null,
  });
  revalidatePath(`/plan/${tripId}/places`);
  return error ? { error: "Couldn't add that place." } : { ok: true };
}

/** Figma 35 "drag to reorder" — up/down buttons (easier to hit on a phone and usable with a keyboard). */
export async function moveStop(tripId: string, stopId: string, dir: -1 | 1) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("plan_stops").select("id").eq("trip_id", tripId).eq("source", "user")
    .order("priority", { nullsFirst: false }).order("created_at");
  const ids = (data ?? []).map((r) => r.id);
  const i = ids.indexOf(stopId), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  // all at once: one update per stop in sequence meant the arrow took a round trip per place in the list
  await Promise.all(ids.map((id, k) => supabase.from("plan_stops").update({ priority: k }).eq("id", id)));
  revalidatePath(`/plan/${tripId}/places`);
}

export async function removeStop(tripId: string, stopId: string) {
  const { supabase } = await requireUser();
  await supabase.from("plan_stops").delete().eq("id", stopId);
  revalidatePath(`/plan/${tripId}/places`);
  revalidatePath(`/plan/${tripId}`);
}

export async function pinStop(tripId: string, stopId: string, form: FormData) {
  const day = Number(form.get("day")) || null;
  const time = String(form.get("time") || "") || null;
  const { supabase } = await requireUser();
  await supabase.from("plan_stops").update({ fixed_day: day, fixed_time: time }).eq("id", stopId);
  revalidatePath(`/plan/${tripId}/places`);
}

const dayTitles = z.object({ days: z.array(z.object({ day: z.number(), title: z.string().max(60) })).max(14) });

/**
 * 31b → 31. Builds the itinerary. Ato (the model) plans the days from the traveller's must-visit
 * places and real nearby places; code checks the answer (real places only, pins kept, no overlaps).
 * If the model is unavailable or its answer is unusable, the code planner builds the days instead.
 */
export async function buildPlan(tripId: string) {
  const { supabase, user } = await requireUser();
  const [{ data: trip }, { data: stops }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("plan_stops").select("*").eq("trip_id", tripId).order("priority", { nullsFirst: false }).order("created_at"),
  ]);
  if (!trip) return { error: "Trip not found." };
  if (trip.dest_lat === null) return { error: "This plan has no destination." };

  const days = Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1);
  const style = (trip.plan_style ?? {}) as { pace?: Pace; interests?: string[] };
  const userStops = ((stops ?? []) as (UserStop & { source: string })[]).filter((s) => s.source === "user");
  const pace = style.pace ?? "balanced";
  const interests = style.interests ?? [];
  const center = { lat: trip.dest_lat, lng: trip.dest_lng };
  const destination = trip.destination ?? trip.name;

  // The page may run 60 s. Every slow step below gets what is left of that, so the build always
  // finishes and saves something, even on a day when every outside service is slow.
  const started = Date.now();
  const left = (endAt: number) => started + endAt - Date.now();

  // Ato's backup list of place names is asked for alongside Overpass, so it is ready if needed
  const named = askAtoForPlaces({ destination, interests, skip: userStops.map((s) => s.name) });
  const [found, learned] = await Promise.all([
    // the build screen shows progress, so this is the one place worth waiting for OpenStreetMap
    nearbyPois(supabase, trip.dest_lat, trip.dest_lng, POI_BUDGET.build),
    learnForUser(supabase, user.id), // the memory → planning loop
  ]);
  // Overpass busy → keep only the names from Ato that the map confirms near the destination
  let candidates = found;
  if (!candidates.length) {
    const names = await named;
    if (names) candidates = await checkNamedPlaces(supabase, center, { destination, places: names.places, skip: userStops.map((s) => s.name), deadline: started + 38_000 });
  }

  // Ato plans the whole trip from real places only. n8n and then Groq each get half of what is
  // left before the 55 s mark (at most 15 s), so the save below always fits.
  const options = shortlist({ candidates, userStops, interests, center, learned });
  const range = perDayRange(pace, learned);
  const ai = await aiJSON(
    "plan_itinerary",
    AI_PLAN_SYSTEM(range.min, range.max, pace === "packed" ? "08:00" : pace === "slow" ? "09:30" : "09:00"),
    aiPlanPrompt({ destination, startDate: trip.start_date, days, pace, interests, budget: trip.budget ?? null, userStops, shortlist: options, learned }),
    aiPlanSchema,
    { timeoutMs: Math.max(4_000, Math.min(15_000, Math.floor(left(55_000) / 2))) },
  );
  const fromAi = ai ? applyAiPlan(ai, { userStops, candidates: options, days, pace, learned }) : null;
  const plan: Scheduled[] = fromAi?.plan ?? buildItinerary({ userStops, candidates, days, pace, interests, center, learned });

  // replace the previous fill, keep every user stop
  await supabase.from("plan_stops").delete().eq("trip_id", tripId).eq("source", "ato");
  await Promise.all(
    plan.filter((p) => p.source === "user").map((s) =>
      supabase.from("plan_stops")
        .update({ day: s.day, position: s.position, start_time: s.start, duration_min: s.duration, category: s.category })
        .eq("id", s.id!)),
  );
  const picks = plan.filter((p) => p.source === "ato");
  if (picks.length) {
    await supabase.from("plan_stops").insert(picks.map((s) => ({
      trip_id: tripId, name: s.name, lat: s.lat, lng: s.lng, category: s.category, source: "ato",
      reason: s.reason, day: s.day, position: s.position, start_time: s.start, duration_min: s.duration, osm_ref: s.ref,
    })));
  }

  // day titles come with Ato's plan; the code plan asks the model for titles separately
  // (skipped when the model did not answer at all — it would only time out again)
  const titles = fromAi?.titles.length
    ? { days: fromAi.titles }
    : ai === null || left(52_000) < 4_000 ? null : await aiJSON(
      "plan_titles",
      `You are Ato, a warm goldfish trip planner. Give each day a short title (max 6 words) based ONLY on its stops. Return JSON {"days":[{"day":number,"title":string}]}.`,
      JSON.stringify(Array.from({ length: days }, (_, i) => ({ day: i + 1, stops: plan.filter((p) => p.day === i + 1).map((p) => p.name) }))),
      dayTitles,
      { timeoutMs: Math.min(10_000, Math.floor(left(55_000) / 2)) },
    );
  await supabase.from("trips")
    // stays and eats belong to the old stops; addStaysAndFood finds new ones next
    .update({ plan_style: { ...style, day_titles: titles?.days ?? [], learned: learned.notes, planned_by: fromAi ? "ato" : "rules", built_at: new Date().toISOString(), stays: [], eats: {} } })
    .eq("id", tripId);

  revalidatePath(`/plan/${tripId}`);
  return { ok: true };
}

/**
 * 31, after the build: where to stay and where to eat near each stop. A separate step (the build
 * screen calls it next) so it gets its own time limit. Every hotel and restaurant is a real map
 * entry; Ato only picks among the ranked hotels and says why.
 */
export async function addStaysAndFood(tripId: string) {
  const { supabase, user } = await requireUser();
  const [{ data: trip }, { data: rows }, { data: me }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("plan_stops").select("id, name, lat, lng, day, position").eq("trip_id", tripId).not("day", "is", null).order("day").order("position"),
    supabase.from("profiles").select("travel_style").eq("id", user.id).maybeSingle(),
  ]);
  if (!trip || trip.owner_id !== user.id) return { error: "Only the trip leader can change the plan." };
  const stops = (rows ?? []) as { id: string; name: string; lat: number; lng: number; day: number }[];
  if (!stops.length) return { ok: true };

  const days = Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1);
  const tier = budgetTier(trip.budget ?? null, days, (me?.travel_style as { budget?: string } | null)?.budget);

  // Nominatim allows one request a second, so the lookups run one after another
  let last = 0;
  const lookup = async (what: "hotel" | "hostel" | "restaurant", box: ReturnType<typeof boxAround>) => {
    const wait = last + 1_100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return mapPlacesIn(what, box);
  };

  // hotels within about 2 km of the middle of the plan; hostels too for a budget trip
  const hotels = await lookup("hotel", boxAround(stops, 0.02));
  if (tier === "budget") hotels.push(...await lookup("hostel", boxAround(stops, 0.02)));

  // restaurants: one search per day, around that day's stops
  const foods: MapPlace[] = [];
  for (const d of [...new Set(stops.map((s) => s.day))]) {
    foods.push(...await lookup("restaurant", boxAround(stops.filter((s) => s.day === d), 0.008)));
  }

  const ranked = rankStays(hotels, stops);
  const ai = ranked.length
    ? await aiJSON("plan_stays", STAYS_SYSTEM(tier), staysPrompt({ destination: trip.destination ?? trip.name, tier, hotels: ranked }), staysSchema, { timeoutMs: 12_000 })
    : null;
  const stays = applyStays(ai, ranked, tier);
  const eats = eatsNearStops(stops, foods);

  // re-read: the plan may have been rebuilt while this ran
  const { data: fresh } = await supabase.from("trips").select("plan_style").eq("id", tripId).single();
  await supabase.from("trips").update({ plan_style: { ...(fresh?.plan_style ?? {}), stays, eats, stay_tier: tier } }).eq("id", tripId);
  revalidatePath(`/plan/${tripId}`);
  return { ok: true };
}

/** A plan becomes a memory trip. */
export async function startTrip(tripId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("trips").update({ status: "ongoing" }).eq("id", tripId).eq("owner_id", user.id);
  revalidatePath("/");
  redirect(`/trips/${tripId}`);
}
