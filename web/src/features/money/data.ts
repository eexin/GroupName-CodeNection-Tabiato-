import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { myr } from "@/lib/currency";
import { person, type Person } from "@/lib/people";
import type { Expense, Trip } from "@/lib/types";
import { peopleById } from "@/features/trips/data";
import { budgetStatus, ledger, type MoneyExpense } from "@/features/money/settle";

/** Today's date where the travellers are (MYT); good enough for "days left". */
export const localToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

export type MoneyRow = Expense & { from_kitty: boolean; myr: number; shares: string[]; place: string | null };

/** Everything the Money page needs: who is on the trip, every expense with who shares it, the kitty and payments. */
export async function getMoney(supabase: SupabaseClient, tripId: string, userId: string) {
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!trip) return null;
  const [{ data: members }, { data: expenses }, { data: shares }, { data: deposits }, { data: payments }, { data: places }] = await Promise.all([
    supabase.from("trip_members").select("user_id, status").eq("trip_id", tripId),
    supabase.from("expenses").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("expense_shares").select("expense_id, user_id").eq("trip_id", tripId),
    supabase.from("kitty_deposits").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("settlements").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("places").select("id, name").eq("trip_id", tripId).order("first_seen_at", { nullsFirst: false }),
  ]);
  const joined = (members ?? []).filter((m) => m.status === "joined").map((m) => m.user_id as string);
  const isMember = joined.includes(userId);
  if (!isMember) return { trip: trip as Trip, isMember: false as const };

  const placeName = new Map((places ?? []).map((p) => [p.id as string, p.name as string]));
  const sharesBy = new Map<string, string[]>();
  for (const s of shares ?? []) sharesBy.set(s.expense_id, [...(sharesBy.get(s.expense_id) ?? []), s.user_id]);
  const rows: MoneyRow[] = ((expenses ?? []) as Expense[]).map((e) => ({
    ...e, from_kitty: Boolean(e.from_kitty), myr: myr(e), shares: sharesBy.get(e.id) ?? [], place: e.place_id ? placeName.get(e.place_id) ?? null : null,
  }));
  const deps = (deposits ?? []).map((d) => ({ ...d, myr: myr(d) })) as { id: string; user_id: string; amount: number; currency: string; amount_myr: number | null; myr: number; created_at: string }[];
  const pays = (payments ?? []) as { id: string; from_user: string; to_user: string; amount_myr: number; created_at: string }[];

  const people = await peopleById(supabase, [...joined, ...rows.map((r) => r.paid_by), ...deps.map((d) => d.user_id), ...pays.flatMap((p) => [p.from_user, p.to_user])]);
  const who = (id: string): Person => people.get(id) ?? person(id, null);

  const L = ledger(
    joined,
    rows.map((r): MoneyExpense => ({ id: r.id, paid_by: r.paid_by, from_kitty: r.from_kitty, myr: r.myr, split_count: r.split_count, shares: r.shares })),
    deps.map((d) => ({ user_id: d.user_id, myr: d.myr })),
    pays.map((p) => ({ from: p.from_user, to: p.to_user, myr: Number(p.amount_myr) })),
  );
  const t = trip as Trip & { budget: number | null };
  return {
    trip: t,
    isMember: true as const,
    members: joined.map(who).sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : a.name.localeCompare(b.name))),
    who,
    expenses: rows,
    unpriced: rows.filter((r) => r.myr === 0 && Number(r.amount) > 0).length,
    deposits: deps,
    payments: pays,
    places: (places ?? []) as { id: string; name: string }[],
    ledger: L,
    budget: t.budget != null && Number(t.budget) > 0 ? budgetStatus(Number(t.budget), L.total, t.start_date, t.end_date, localToday()) : null,
  };
}

/** The short line on the trip page's money card: spent, budget, and where you stand. */
export async function moneySummary(supabase: SupabaseClient, tripId: string, userId: string) {
  const m = await getMoney(supabase, tripId, userId);
  if (!m || !m.isMember) return null;
  const mine = m.ledger.people[userId]?.net ?? 0;
  const owe = m.ledger.transfers.filter((t) => t.from === userId).reduce((a, t) => a + t.myr, 0);
  const owed = m.ledger.transfers.filter((t) => t.to === userId).reduce((a, t) => a + t.myr, 0);
  return { spent: m.ledger.total, budget: m.budget, net: mine, owe, owed, settled: m.ledger.settled, kittyLeft: m.ledger.kitty.in > 0 ? m.ledger.kitty.left : null, count: m.expenses.length };
}
