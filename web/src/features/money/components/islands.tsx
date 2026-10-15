"use client";

import { useActionState, useTransition } from "react";
import { CURRENCIES } from "@/lib/currency";
import { shortName, type Person } from "@/lib/people";
import type { ActionResult } from "@/lib/types";
import { addDeposit, deleteDeposit, deleteExpense, markPaid, setBudget, undoPayment } from "@/features/money/actions";

const box = "h-10 w-full min-w-0 rounded-[10px] border border-line bg-card px-3 text-[13px] text-ink placeholder:text-muted focus:border-coral focus:outline-none";

export function MarkPaid({ tripId, from, to, amount, label }: { tripId: string; from: string; to: string; amount: number; label: string }) {
  const [busy, start] = useTransition();
  return (
    <button onClick={() => start(async () => { await markPaid(tripId, from, to, amount); })} disabled={busy} aria-label={label}
      className="min-h-[36px] shrink-0 rounded-full bg-coral px-3 text-[11px] font-bold text-white disabled:opacity-60">
      {busy ? "Saving…" : "Mark as paid"}
    </button>
  );
}

export function Remove({ kind, id, tripId, placeId, label }: { kind: "expense" | "deposit" | "payment"; id: string; tripId: string; placeId?: string | null; label: string }) {
  const [busy, start] = useTransition();
  const run = () => start(async () => {
    if (kind === "expense") await deleteExpense(id, tripId, placeId);
    else if (kind === "deposit") await deleteDeposit(id, tripId);
    else await undoPayment(id, tripId);
  });
  if (kind === "payment") {
    return <button onClick={run} disabled={busy} className="min-h-[36px] shrink-0 px-2 text-[11px] font-bold text-coral-dark disabled:opacity-60">{busy ? "…" : "Undo"}</button>;
  }
  return (
    <button onClick={run} disabled={busy} aria-label={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px] leading-none text-muted disabled:opacity-40">×</button>
  );
}

/** 公账: put money into the kitty, for yourself or for someone who handed you cash. */
export function DepositForm({ tripId, members, me, currency }: { tripId: string; members: Person[]; me: string; currency: string }) {
  const [state, action, busy] = useActionState<ActionResult, FormData>(addDeposit.bind(null, tripId), {});
  return (
    <form action={action} className="mt-3 space-y-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <select name="currency" defaultValue={currency} aria-label="Currency" className="h-10 rounded-[10px] border border-line bg-card px-2 text-[12px] text-ink">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c === "MYR" ? "RM" : c}</option>)}
        </select>
        <input name="amount" inputMode="decimal" placeholder="Amount put in" aria-label="Amount put in" required className={box} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        {members.length > 1 ? (
          <select name="user_id" defaultValue="me" aria-label="Who put it in" className="h-10 min-w-0 rounded-[10px] border border-line bg-card px-2 text-[12px] text-ink">
            {members.map((m) => <option key={m.id} value={m.id === me ? "me" : m.id}>{m.id === me ? "From you" : `From ${shortName(m.name)}`}</option>)}
          </select>
        ) : <input type="hidden" name="user_id" value="me" />}
        <button disabled={busy} className={`h-10 rounded-[10px] bg-deep px-4 text-[12px] font-bold text-white disabled:opacity-60 ${members.length > 1 ? "" : "col-span-2"}`}>
          {busy ? "Adding…" : "Add to kitty"}
        </button>
      </div>
      {state.error && <p role="alert" className="text-[11.5px] text-coral-dark">{state.error}</p>}
    </form>
  );
}

export function BudgetForm({ tripId, budget }: { tripId: string; budget: number | null }) {
  const [state, action, busy] = useActionState<ActionResult, FormData>(setBudget.bind(null, tripId), {});
  return (
    <form action={action} className="mt-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="relative block min-w-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">RM</span>
          <input name="budget" inputMode="decimal" defaultValue={budget ?? ""} placeholder="3000" aria-label="Budget for the whole trip, in RM" className={`${box} pl-10`} />
        </label>
        <button disabled={busy} className="h-10 rounded-[10px] bg-deep px-4 text-[12px] font-bold text-white disabled:opacity-60">{busy ? "Saving…" : "Save budget"}</button>
      </div>
      {state.error && <p role="alert" className="mt-1.5 text-[11.5px] text-coral-dark">{state.error}</p>}
      {state.ok && <p role="status" className="mt-1.5 text-[11.5px] text-muted">Saved.</p>}
    </form>
  );
}
