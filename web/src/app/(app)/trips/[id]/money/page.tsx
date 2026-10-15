import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ato } from "@/components/ato";
import { Avatar, BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getMoney } from "@/features/money/data";
import { ExpenseForm, KittyIcon } from "@/features/money/components/expense-form";
import { BudgetForm, DepositForm, MarkPaid, Remove } from "@/features/money/components/islands";
import { currencyForCountry, money } from "@/lib/currency";
import { shortName } from "@/lib/people";
import { formatDay } from "@/lib/time";

const rm = (n: number) => money(Math.round(n * 100) / 100);
const H2 = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="mb-2 mt-7 flex items-baseline justify-between gap-3">
    <h2 className="text-[15px] font-bold text-ink">{children}</h2>
    {right && <span className="shrink-0 text-[11px] text-muted">{right}</span>}
  </div>
);

/** Money: the trip budget, settle up (分账), the group kitty (公账) and every expense, in one place. */
export default async function MoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const m = await getMoney(supabase, id, user.id);
  if (!m) notFound();
  if (!m.isMember) redirect(`/trips/${id}`);

  const { trip, ledger: L, budget: b, who } = m;
  const me = user.id;
  const owner = trip.owner_id === me;
  const group = m.members.length > 1;
  const cur = currencyForCountry(trip.country_code);
  const mine = L.people[me]?.net ?? 0;
  const myLine = L.settled ? null : mine > 0.01 ? `You get back ${rm(mine)}` : mine < -0.01 ? `You owe ${rm(-mine)}` : "You're even";
  const kittyOn = L.kitty.in > 0 || L.kitty.spent > 0;

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-28 lg:max-w-2xl lg:pt-4">
      <BackHeader href={`/trips/${id}`} title="Money" subtitle={trip.name} />
      <div className="px-6">

        {/* budget: one total for the whole trip, in RM */}
        <section aria-labelledby="budget" className="rounded-[20px] bg-card p-4 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="budget" className="text-[11px] font-bold text-muted">{b ? "Spent of your budget" : "Spent so far"}</h2>
            {b && <span className={`text-[11px] font-bold ${b.over ? "text-coral-dark" : "text-muted"}`}>{b.pct}%</span>}
          </div>
          <p className="mt-1 text-[24px] font-bold leading-tight text-ink">
            {rm(L.total)}{b && <span className="text-[14px] font-medium text-muted"> of {rm(b.budget)}</span>}
          </p>
          {b && (
            <>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="Budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, b.pct)}>
                <div className={`h-full rounded-full ${b.over ? "bg-coral" : b.pct >= 85 ? "bg-sand" : "bg-deep"}`} style={{ width: `${Math.min(100, b.pct)}%` }} />
              </div>
              <p className={`mt-2 text-[12px] ${b.over ? "font-bold text-coral-dark" : "text-body"}`}>
                {b.over ? `${rm(-b.left)} over budget`
                  : `${rm(b.left)} left${b.perDay != null && b.daysLeft ? ` · about ${money(Math.floor(b.perDay))} a day for ${b.daysLeft} ${b.daysLeft === 1 ? "day" : "days"}` : ""}`}
              </p>
            </>
          )}
          {m.unpriced > 0 && (
            <p className="mt-2 text-[11px] text-amber-ink">{m.unpriced} {m.unpriced === 1 ? "expense has" : "expenses have"} no exchange rate yet, so {m.unpriced === 1 ? "it isn't" : "they aren't"} counted.</p>
          )}
          {owner ? (
            <details className="group mt-3 border-t border-line pt-2" open={!b}>
              <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between text-[12px] font-bold text-coral [&::-webkit-details-marker]:hidden">
                {b ? "Change budget" : "Set a budget for the whole trip"}
                <span aria-hidden className="text-muted transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <BudgetForm tripId={id} budget={trip.budget != null ? Number(trip.budget) : null} />
            </details>
          ) : !b && (
            <p className="mt-2 text-[11px] text-muted">{shortName(who(trip.owner_id).name)} can set a budget for the trip.</p>
          )}
        </section>

        {/* settle up */}
        {group && (
          <>
            <H2 right={myLine}>Settle up</H2>
            {L.total === 0 ? (
              <p className="rounded-[16px] bg-card px-4 py-3 text-[12.5px] text-body shadow-card">Add what you spend below and I&apos;ll work out who owes whom.</p>
            ) : L.settled ? (
              <div className="flex items-center gap-3 rounded-[16px] bg-card p-4 shadow-card">
                <Ato size={52} mood="happy" />
                <p className="min-w-0 text-[12.5px] text-ink"><strong className="block text-[14px]">All settled</strong>Nobody owes anybody. I checked every expense{kittyOn ? " and the kitty" : ""}.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {L.transfers.map((t) => {
                  const f = who(t.from), to = who(t.to);
                  const line = `${t.from === me ? "You pay" : `${shortName(f.name)} pays`} ${t.to === me ? "you" : shortName(to.name)}`;
                  return (
                    <li key={`${t.from}-${t.to}`} className="flex items-center gap-2.5 rounded-[16px] bg-card p-3 shadow-card">
                      <span className="flex shrink-0 items-center">
                        <Avatar p={f} size={30} />
                        <svg width="14" height="10" viewBox="0 0 16 10" aria-hidden className="mx-0.5 text-muted"><path d="M1 5h13M10 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <Avatar p={to} size={30} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] leading-snug text-body">{line}</span>
                        <span className="block text-[15px] font-bold text-ink">{rm(t.myr)}</span>
                      </span>
                      {(t.from === me || t.to === me) && <MarkPaid tripId={id} from={t.from} to={t.to} amount={t.myr} label={`Mark ${rm(t.myr)} from ${shortName(f.name)} to ${shortName(to.name)} as paid`} />}
                    </li>
                  );
                })}
              </ul>
            )}
            {L.total > 0 && (
              <details className="group mt-2 rounded-[16px] bg-card shadow-card">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 text-[12px] font-bold text-deep [&::-webkit-details-marker]:hidden">
                  How it adds up
                  <span aria-hidden className="text-muted transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <div className="px-4 pb-3">
                  <table className="w-full table-fixed text-[11.5px]">
                    <thead>
                      <tr className="text-left text-[10px] text-muted">
                        <th className="pb-1.5 font-medium">Person</th>
                        <th className="w-[26%] pb-1.5 text-right font-medium">Paid</th>
                        <th className="w-[26%] pb-1.5 text-right font-medium">Their share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.members.map((p) => {
                        const r = L.people[p.id];
                        if (!r) return null;
                        return (
                          <tr key={p.id} className="border-t border-line">
                            <td className="truncate py-1.5 text-ink">{p.id === me ? "You" : shortName(p.name)}</td>
                            <td className="py-1.5 text-right text-body">{rm(r.paid + r.kittyUsed)}</td>
                            <td className="py-1.5 text-right text-body">{rm(r.share)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[10.5px] text-muted">Each expense is split equally between the people ticked on it.{kittyOn ? " What the kitty paid counts as paid by whoever put money in, by how much they put in." : ""}</p>
                </div>
              </details>
            )}
            {m.payments.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {m.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-[12px] bg-surface px-3 py-1.5 text-[11.5px] text-body">
                    <span aria-hidden className="text-deep">✓</span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.from_user === me ? "You" : shortName(who(p.from_user).name)} paid {p.to_user === me ? "you" : shortName(who(p.to_user).name)} {rm(Number(p.amount_myr))}
                    </span>
                    {(p.from_user === me || p.to_user === me) && <Remove kind="payment" id={p.id} tripId={id} label="Undo payment" />}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* the kitty (公账) */}
        {group && (
          <>
            <H2 right={kittyOn ? `${rm(L.kitty.left)} left` : undefined}>Kitty</H2>
            <section className="rounded-[16px] bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <KittyIcon size={36} />
                <p className="min-w-0 text-[12px] text-body">
                  {kittyOn
                    ? <><strong className="text-ink">{rm(L.kitty.in)}</strong> put in · <strong className="text-ink">{rm(L.kitty.spent)}</strong> spent</>
                    : "Shared money everyone chips into. Pay from it when you add an expense; whatever is left goes back by how much each person put in."}
                </p>
              </div>
              {L.kitty.left < -0.005 && (
                <p className="mt-3 rounded-[10px] bg-sand-wash px-3 py-2 text-[11.5px] text-amber-ink">The kitty has paid {rm(-L.kitty.left)} more than was put in. Add the top-up below.</p>
              )}
              {L.kitty.left > 0.005 && L.kitty.in > 0 && (
                <div className="mt-3 rounded-[10px] bg-surface px-3 py-2">
                  <p className="text-[10.5px] font-bold text-muted">Left over goes back</p>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(L.kitty.refunds).map(([uid, amt]) => (
                      <li key={uid} className="flex justify-between gap-2 text-[11.5px] text-body">
                        <span className="truncate">{uid === me ? "You" : shortName(who(uid).name)}</span><span className="shrink-0 font-bold text-ink">{rm(amt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.deposits.length > 0 && (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {m.deposits.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 py-1">
                      <Avatar p={who(d.user_id)} size={26} />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-body">{d.user_id === me ? "You" : shortName(who(d.user_id).name)} put in {money(Number(d.amount), d.currency)}</span>
                      <Remove kind="deposit" id={d.id} tripId={id} label="Remove this deposit" />
                    </li>
                  ))}
                </ul>
              )}
              <DepositForm tripId={id} members={m.members} me={me} currency={cur} />
            </section>
          </>
        )}

        {/* every expense, including ones not at a place (stay, flights) */}
        <H2 right={`${m.expenses.length} ${m.expenses.length === 1 ? "expense" : "expenses"}`}>All spending</H2>
        <details className="group" open={m.expenses.length === 0}>
          <summary className="flex h-11 cursor-pointer list-none items-center justify-center rounded-[14px] bg-coral text-[13px] font-bold text-white group-open:hidden [&::-webkit-details-marker]:hidden">+ Add expense</summary>
          <ExpenseForm tripId={id} members={m.members} me={me} currency={cur} places={m.places} kitty={L.kitty.in > 0} />
        </details>
        {m.expenses.length > 0 && (
          <ul className="mt-3 space-y-2">
            {m.expenses.map((e) => {
              const payer = e.from_kitty ? "From the kitty" : `${e.paid_by === me ? "You" : shortName(who(e.paid_by).name)} paid`;
              const split = e.split_count > 1 ? ` · split ${e.split_count} ways` : group ? " · not split" : "";
              return (
                <li key={e.id} className="flex items-center gap-3 rounded-[14px] bg-card py-2.5 pl-3 pr-1 shadow-card">
                  {e.from_kitty ? <KittyIcon size={34} /> : <Avatar p={who(e.paid_by)} size={34} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-bold text-ink">{e.label || "Expense"}</span>
                      <span className="shrink-0 text-[13px] font-bold text-ink">{money(Number(e.amount), e.currency)}</span>
                    </span>
                    <span className="flex items-baseline justify-between gap-2 text-[10.5px] text-muted">
                      <span className="truncate">{payer}{split}</span>
                      <span className="shrink-0">{e.currency !== "MYR" ? (e.amount_myr != null ? `≈ ${rm(Number(e.amount_myr))}` : "no rate") : formatDay(e.created_at)}</span>
                    </span>
                    {e.place && <span className="block truncate text-[10.5px] text-muted">at {e.place}</span>}
                  </span>
                  <Remove kind="expense" id={e.id} tripId={id} placeId={e.place_id} label={`Remove ${e.label || "expense"}`} />
                </li>
              );
            })}
          </ul>
        )}
        {m.expenses.some((e) => e.place_id) && (
          <p className="mt-3 text-center text-[11px] text-muted">Spending at a place also shows on that place. <Link href={`/trips/${id}`} className="font-bold text-coral">See places</Link></p>
        )}
      </div>
    </main>
  );
}
