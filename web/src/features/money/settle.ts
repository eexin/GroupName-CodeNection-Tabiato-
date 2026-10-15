/**
 * Settle up (分账) and the group kitty (公账) — pure maths, no I/O, all in MYR.
 *
 * Work in whole sen (cents) so every split adds back up exactly; the odd sen goes to the first
 * people in a stable order. The kitty is treated as money its depositors paid in proportion to what
 * they put in: what the kitty spent counts as theirs, and what is left goes back by the same share.
 */

export type MoneyExpense = {
  id: string;
  paid_by: string;
  from_kitty: boolean;
  myr: number;              // already converted; 0 if no rate (see `unpriced`)
  split_count: number;
  shares: string[];         // people who share it; empty = an older expense (see sharersOf)
};
export type Deposit = { user_id: string; myr: number };
export type Payment = { from: string; to: string; myr: number };
export type Transfer = { from: string; to: string; myr: number };

const sen = (myr: number) => Math.round(myr * 100);
const rm = (s: number) => s / 100;

/** Split `total` sen equally between `ids`, the remainder one sen each to the first ones. */
export function splitEqually(total: number, ids: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const sorted = [...ids].sort();
  const base = Math.trunc(total / sorted.length);
  let rest = total - base * sorted.length;
  for (const id of sorted) {
    const extra = rest > 0 ? 1 : rest < 0 ? -1 : 0;
    rest -= extra;
    out.set(id, base + extra);
  }
  return out;
}

/** Split `total` sen by weight (deposit share), largest remainders first so it adds up exactly. */
export function splitByWeight(total: number, weights: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  const sum = [...weights.values()].reduce((a, b) => a + b, 0);
  if (sum <= 0) return out;
  const parts = [...weights.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([id, w]) => { const exact = (total * w) / sum; return { id, whole: Math.floor(exact), frac: exact - Math.floor(exact) }; });
  let rest = total - parts.reduce((a, p) => a + p.whole, 0);
  for (const p of [...parts].sort((a, b) => b.frac - a.frac || a.id.localeCompare(b.id))) {
    if (rest <= 0) break;
    p.whole++;
    rest--;
  }
  for (const p of parts) out.set(p.id, p.whole);
  return out;
}

/** Who shares an expense: the people ticked; for older ones, the payer alone, or everyone if it was split. */
export function sharersOf(e: MoneyExpense, members: string[]): string[] {
  if (e.shares.length) return e.shares;
  if (e.from_kitty || e.split_count > 1) return members;
  return [e.paid_by];
}

export type Ledger = {
  people: Record<string, { paid: number; share: number; kittyIn: number; kittyUsed: number; settledOut: number; settledIn: number; net: number }>;
  total: number;            // everything the group spent, MYR
  kitty: { in: number; spent: number; left: number; refunds: Record<string, number> };
  transfers: Transfer[];    // fewest payments that settle everyone, after "Mark as paid"
  settled: boolean;
};

/**
 * net > 0: the group owes you; net < 0: you owe. Always sums to zero.
 *   net = paid by you + your part of what the kitty spent − your share of every expense
 *         + payments you made − payments you received
 */
export function ledger(members: string[], expenses: MoneyExpense[], deposits: Deposit[], payments: Payment[]): Ledger {
  const everyone = [...new Set([...members, ...expenses.filter((e) => !e.from_kitty).map((e) => e.paid_by), ...deposits.map((d) => d.user_id)])];
  const row = () => ({ paid: 0, share: 0, kittyIn: 0, kittyUsed: 0, settledOut: 0, settledIn: 0, net: 0 });
  const p = new Map(everyone.map((id) => [id, row()]));
  const get = (id: string) => { if (!p.has(id)) p.set(id, row()); return p.get(id)!; };

  let total = 0;
  let kittySpent = 0;
  for (const e of expenses) {
    const amount = sen(e.myr);
    if (amount <= 0) continue;
    total += amount;
    if (e.from_kitty) kittySpent += amount;
    else get(e.paid_by).paid += amount;
    for (const [id, part] of splitEqually(amount, sharersOf(e, members.length ? members : everyone))) get(id).share += part;
  }

  const weights = new Map<string, number>();
  for (const d of deposits) {
    const s = sen(d.myr);
    if (s <= 0) continue;
    weights.set(d.user_id, (weights.get(d.user_id) ?? 0) + s);
    get(d.user_id).kittyIn += s;
  }
  const kittyIn = [...weights.values()].reduce((a, b) => a + b, 0);
  // nobody has put money in yet: count what the kitty spent as everyone's, equally
  const used = kittyIn > 0 ? splitByWeight(kittySpent, weights) : splitEqually(kittySpent, members.length ? members : everyone);
  for (const [id, s] of used) get(id).kittyUsed += s;
  const left = kittyIn - kittySpent;
  const refunds = left > 0 ? splitByWeight(left, weights) : new Map<string, number>();

  for (const pay of payments) {
    const s = sen(pay.myr);
    if (s <= 0 || pay.from === pay.to) continue;
    get(pay.from).settledOut += s;
    get(pay.to).settledIn += s;
  }

  for (const r of p.values()) r.net = r.paid + r.kittyUsed - r.share + r.settledOut - r.settledIn;
  const transfers = fewestTransfers(new Map([...p.entries()].map(([id, r]) => [id, r.net])));

  return {
    people: Object.fromEntries([...p.entries()].map(([id, r]) => [id, {
      paid: rm(r.paid), share: rm(r.share), kittyIn: rm(r.kittyIn), kittyUsed: rm(r.kittyUsed),
      settledOut: rm(r.settledOut), settledIn: rm(r.settledIn), net: rm(r.net),
    }])),
    total: rm(total),
    kitty: { in: rm(kittyIn), spent: rm(kittySpent), left: rm(left), refunds: Object.fromEntries([...refunds.entries()].map(([id, s]) => [id, rm(s)])) },
    transfers: transfers.map((t) => ({ ...t, myr: rm(t.myr) })),
    settled: transfers.length === 0,
  };
}

/**
 * Greedy: the person owed most is paid by the person who owes most, until everyone is at zero.
 * At most n−1 payments, and usually the fewest. Input and output in sen.
 */
export function fewestTransfers(net: Map<string, number>): Transfer[] {
  const owed = [...net.entries()].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const owing = [...net.entries()].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: Transfer[] = [];
  const order = (a: { id: string; v: number }, b: { id: string; v: number }) => b.v - a.v || a.id.localeCompare(b.id);
  while (owed.length && owing.length) {
    owed.sort(order);
    owing.sort(order);
    const to = owed[0];
    const from = owing[0];
    const amount = Math.min(to.v, from.v);
    // a sen or two of rounding is not worth a payment
    if (amount > 1) out.push({ from: from.id, to: to.id, myr: amount });
    to.v -= amount;
    from.v -= amount;
    if (to.v <= 1) owed.shift();
    if (from.v <= 1) owing.shift();
  }
  return out;
}

export type BudgetStatus = {
  budget: number;
  spent: number;
  left: number;             // negative when over
  pct: number;              // 0–100+, for the bar
  over: boolean;
  daysLeft: number | null;  // including today; null when dates are unknown or the trip is over
  perDay: number | null;    // what is left, per remaining day
};

/** One budget for the whole trip, in MYR. `today` is YYYY-MM-DD in the trip's local time. */
export function budgetStatus(budget: number, spent: number, start: string | null, end: string | null, today: string): BudgetStatus {
  const left = Math.round((budget - spent) * 100) / 100;
  const day = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
  let daysLeft: number | null = null;
  if (end && today <= end) daysLeft = day(end) - day(start && today < start ? start : today) + 1;
  return {
    budget, spent, left,
    pct: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    over: left < 0,
    daysLeft,
    perDay: daysLeft && daysLeft > 0 && left > 0 ? Math.floor((left / daysLeft) * 100) / 100 : null,
  };
}
