"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/guards";
import { aiJSON } from "@/lib/ai";
import { CURRENCIES, type Currency } from "@/lib/currency";
import { toMYR } from "@/lib/fx";
import type { ActionResult } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

function refresh(tripId: string, placeId?: string | null) {
  revalidatePath(`/trips/${tripId}/money`);
  revalidatePath(`/trips/${tripId}`);
  if (placeId) revalidatePath(`/places/${placeId}`);
}

async function joinedIds(supabase: Supa, tripId: string) {
  const { data } = await supabase.from("trip_members").select("user_id").eq("trip_id", tripId).eq("status", "joined");
  return (data ?? []).map((m) => m.user_id as string);
}

const amountField = z.coerce.number({ message: "Enter an amount." }).positive("Enter an amount above zero.").max(1_000_000, "That's more than RM 1,000,000.");
const currencyField = z.enum(CURRENCIES).catch("MYR");

const expenseSchema = z.object({
  amount: amountField,
  currency: currencyField,
  label: z.string().trim().max(60).optional(),
  paid_by: z.string().min(1),
  place_id: z.string().uuid().nullable(),
});

/**
 * Add an expense: who paid (a person or the kitty) and who shares it, split equally.
 * Shares default to everyone on the trip; untick people who weren't part of it.
 */
export async function addExpense(tripId: string, placeId: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  const place = placeId ?? (String(form.get("place_id") ?? "") || null);
  const parsed = expenseSchema.safeParse({
    amount: String(form.get("amount") ?? "").replace(/,/g, ""),
    currency: form.get("currency") || "MYR",
    label: form.get("label") || undefined,
    paid_by: form.get("paid_by") || "me",
    place_id: place,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const members = await joinedIds(supabase, tripId);
  if (!members.includes(user.id)) return { error: "Only people on this trip can add spending." };

  const kitty = parsed.data.paid_by === "kitty";
  const payer = kitty || parsed.data.paid_by === "me" ? user.id : parsed.data.paid_by;
  if (!members.includes(payer)) return { error: "Pick who paid from the people on this trip." };
  // no split-with boxes on the form (a one-person trip): it's the payer's alone
  const ticked = form.has("share_shown") ? form.getAll("share").map(String).filter((id) => members.includes(id)) : [payer];
  if (!ticked.length) return { error: "Tick at least one person to split with." };

  const amount_myr = await toMYR(parsed.data.amount, parsed.data.currency);
  const { data: row, error } = await supabase.from("expenses").insert({
    trip_id: tripId, place_id: parsed.data.place_id, paid_by: payer, from_kitty: kitty,
    amount: parsed.data.amount, currency: parsed.data.currency, amount_myr,
    label: parsed.data.label ?? null, split_count: ticked.length,
  }).select("id").single();
  if (error || !row) return { error: "Couldn't add that expense. Try again." };
  const { error: shareError } = await supabase.from("expense_shares").insert(ticked.map((u) => ({ expense_id: row.id, trip_id: tripId, user_id: u })));
  if (shareError) {
    await supabase.from("expenses").delete().eq("id", row.id);
    return { error: "Couldn't save who shares it. Try again." };
  }
  refresh(tripId, parsed.data.place_id);
  return { ok: true };
}

export async function deleteExpense(expenseId: string, tripId: string, placeId?: string | null): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) return { error: "Couldn't remove it." };
  refresh(tripId, placeId);
  return { ok: true };
}

/** 公账: someone put money into the group kitty. */
export async function addDeposit(tripId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = z.object({ amount: amountField, currency: currencyField, user_id: z.string().min(1) }).safeParse({
    amount: String(form.get("amount") ?? "").replace(/,/g, ""), currency: form.get("currency") || "MYR", user_id: form.get("user_id") || "me",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const members = await joinedIds(supabase, tripId);
  const who = parsed.data.user_id === "me" ? user.id : parsed.data.user_id;
  if (!members.includes(user.id) || !members.includes(who)) return { error: "Only people on this trip can add to the kitty." };
  const { error } = await supabase.from("kitty_deposits").insert({
    trip_id: tripId, user_id: who, amount: parsed.data.amount, currency: parsed.data.currency,
    amount_myr: await toMYR(parsed.data.amount, parsed.data.currency),
  });
  if (error) return { error: "Couldn't add that to the kitty." };
  refresh(tripId);
  return { ok: true };
}

export async function deleteDeposit(id: string, tripId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("kitty_deposits").delete().eq("id", id);
  if (error) return { error: "Couldn't remove it." };
  refresh(tripId);
  return { ok: true };
}

/** "Mark as paid": the payer or the person paid records it. Amounts are MYR, as the settle-up shows them. */
export async function markPaid(tripId: string, from: string, to: string, amount: number): Promise<ActionResult> {
  if (!(amount > 0) || from === to) return { error: "Nothing to mark." };
  const { supabase, user } = await requireUser();
  if (user.id !== from && user.id !== to) return { error: "Only the two people in this payment can mark it." };
  const { error } = await supabase.from("settlements").insert({ trip_id: tripId, from_user: from, to_user: to, amount_myr: Math.round(amount * 100) / 100 });
  if (error) return { error: "Couldn't mark it as paid." };
  refresh(tripId);
  return { ok: true };
}

export async function undoPayment(id: string, tripId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("settlements").delete().eq("id", id);
  if (error) return { error: "Only the two people in this payment can undo it." };
  refresh(tripId);
  return { ok: true };
}

/** One budget for the whole trip, in RM. Owner only (it's on the trip itself). Empty clears it. */
export async function setBudget(tripId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const raw = String(form.get("budget") ?? "").replace(/,/g, "").trim();
  const n = raw === "" ? null : Number(raw);
  if (n !== null && (!Number.isFinite(n) || n < 0 || n > 10_000_000)) return { error: "Enter the budget in RM, like 3000." };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("trips").update({ budget: n }).eq("id", tripId).eq("owner_id", user.id).select("id");
  if (error || !data?.length) return { error: "Only the trip owner can set the budget." };
  refresh(tripId);
  return { ok: true };
}

export type ReceiptRead = { error?: string; amount?: number; currency?: Currency; shop?: string; date?: string };

const receiptSchema = z.object({
  total: z.coerce.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  shop: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
});

/**
 * Read a receipt photo: total, currency, shop name. The photo goes to the model once and is
 * never saved — only what you then add (amount and shop) is kept. You check it before saving.
 */
export async function scanReceipt(tripId: string, image: string, fallbackCurrency: string): Promise<ReceiptRead> {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 950_000) return { error: "That photo couldn't be read. Try a smaller or clearer one." };
  const { supabase, user } = await requireUser();
  const members = await joinedIds(supabase, tripId);
  if (!members.includes(user.id)) return { error: "Only people on this trip can add spending." };
  const out = await aiJSON(
    "receipt_scan",
    `You read shop and restaurant receipts. Return JSON {"total": number|null, "currency": string|null, "shop": string|null, "date": string|null}.
- total: the final amount paid (after tax, service charge and discounts) — the grand total, not a subtotal or the change.
- currency: the ISO 4217 code printed or implied by the receipt (e.g. RM → MYR, ¥/円 → JPY, Rp → IDR, ฿ → THB, S$ → SGD). null if you cannot tell.
- shop: the business name as printed, under 40 characters. null if none.
- date: YYYY-MM-DD if printed, else null.
If the photo is not a receipt or the total is unreadable, return all nulls. Never guess a number.`,
    `Read this receipt. If the currency is unclear, the traveller is probably paying in ${fallbackCurrency}.`,
    receiptSchema,
    { image, timeoutMs: 25_000 },
  );
  if (!out) return { error: "I couldn't read it just now. Type the amount instead." };
  const amount = out.total != null && Number.isFinite(out.total) && out.total > 0 ? Math.round(out.total * 100) / 100 : undefined;
  if (!amount) return { error: "I couldn't find a total on that photo. Type the amount instead." };
  const code = (out.currency ?? "").toUpperCase();
  return {
    amount,
    currency: (CURRENCIES as readonly string[]).includes(code) ? (code as Currency) : undefined,
    shop: out.shop?.trim().slice(0, 40) || undefined,
    date: out.date && /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : undefined,
  };
}
