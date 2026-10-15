"use client";

import { useActionState, useEffect, useState } from "react";
import { saveMemoryDetails } from "@/features/places/actions";
import { Avatar } from "@/components/ui";
import { CURRENCIES } from "@/lib/currency";
import type { Person } from "@/lib/people";
import { formatDay, formatTime } from "@/lib/time";
import type { ActionResult } from "@/lib/types";
import { shortName } from "@/lib/people";

/** Figma 18 Memory details — shown right after an upload, for the place most of it landed in. */
export function MemoryDetails({ place, tripId, members, currency, onDone }: {
  place: { id: string; name: string; first_seen_at: string | null }; tripId: string; members: Person[]; currency: string; onDone: () => void;
}) {
  const [state, action, busy] = useActionState<ActionResult, FormData>(saveMemoryDetails.bind(null, place.id, tripId), {});
  const [stars, setStars] = useState(0);
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  const input = "h-11 w-full min-w-0 rounded-[12px] border border-line bg-card px-3 text-[13.5px] focus:border-coral focus:outline-none";
  return (
    <form action={action} className="space-y-5 px-6">
      <div>
        <input name="name" defaultValue={place.name} aria-label="Place name" className="w-full bg-transparent text-[20px] font-bold text-ink focus:outline-none" />
        <p className="text-[11px] text-muted">Detected from photo GPS · tap to change</p>
      </div>
      {place.first_seen_at && (
        <section><h2 className="mb-1 text-[11px] font-bold text-ink">Date &amp; time</h2>
          <p className="text-[13px] text-body">{formatDay(place.first_seen_at)}, {formatTime(place.first_seen_at)}</p></section>
      )}
      <section>
        <h2 className="mb-2 text-[11px] font-bold text-ink">Spent here</h2>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
          <select name="currency" defaultValue={currency} aria-label="Currency" className="h-11 rounded-[12px] border border-line bg-card px-2 text-[12px]">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c === "MYR" ? "RM" : c}</option>)}
          </select>
          <input name="amount" inputMode="decimal" placeholder="Amount" aria-label="Amount" className={input} />
          <input name="label" placeholder="Lunch" aria-label="What for" maxLength={60} className={input} />
        </div>
        {members.length > 1 && (
          <label className="mt-2 flex min-h-[44px] cursor-pointer items-center gap-3 text-[12.5px] text-body">
            <input type="checkbox" name="split_who" defaultChecked className="h-5 w-5 shrink-0 accent-[#b8402a]" />
            <span>You paid; split it equally with everyone who was there <span className="text-muted">(below)</span></span>
          </label>
        )}
      </section>
      <section>
        <h2 className="mb-1 text-[11px] font-bold text-ink">Your rating</h2>
        <input type="hidden" name="stars" value={stars || ""} />
        <div role="radiogroup" aria-label="Your rating" className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} stars`} onClick={() => setStars(n)}
              className="grid h-11 w-10 place-items-center text-[28px]"><span className={n <= stars ? "text-sand-ink" : "text-[#8aa5a1]"}>★</span></button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-[11px] font-bold text-ink">Notes</h2>
        <textarea name="note" rows={3} maxLength={2000} placeholder="What do you want to remember?" className="w-full rounded-[12px] border border-line bg-card p-3 text-[13.5px] focus:border-coral focus:outline-none" />
      </section>
      {members.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-[11px] font-bold text-ink">Who was there</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <label key={m.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-[12.5px] text-body has-[:checked]:border-coral has-[:checked]:bg-[#b8402a14]">
                <input type="checkbox" name="who" value={m.id} defaultChecked className="sr-only" />
                <Avatar p={m} size={32} />{shortName(m.name)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {state.error && <p role="alert" className="text-[12px] text-coral-dark">{state.error}</p>}
      <div className="space-y-2 pb-6">
        <button disabled={busy} className="h-[52px] w-full rounded-[15px] bg-coral text-[15px] font-bold text-white">{busy ? "Saving…" : "Save memory"}</button>
        <button type="button" onClick={onDone} className="h-11 w-full text-[13px] font-bold text-muted">Skip for now</button>
      </div>
    </form>
  );
}
