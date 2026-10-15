"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Ato } from "@/components/ato";
import { Avatar } from "@/components/ui";
import { CURRENCIES, money } from "@/lib/currency";
import { prepareImage } from "@/lib/image";
import { shortName, type Person } from "@/lib/people";
import type { ActionResult } from "@/lib/types";
import { addExpense, scanReceipt } from "@/features/money/actions";

const box = "h-10 w-full min-w-0 rounded-[10px] border border-line bg-card px-3 text-[13px] text-ink placeholder:text-muted focus:border-coral focus:outline-none";
const chip = "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-[12px] text-body has-[:checked]:border-coral has-[:checked]:bg-[#b8402a14] has-[:checked]:text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-coral";

export function KittyIcon({ size = 28 }: { size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-sand-wash" style={{ width: size, height: size }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 16 16">
        <path d="M4.5 2.5h7M5 2.5v1.6C3.5 5 3 6 3 7.5v4.6c0 .9.7 1.4 1.5 1.4h7c.8 0 1.5-.5 1.5-1.4V7.5c0-1.5-.5-2.5-2-3.4V2.5" fill="none" stroke="#86570f" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="9.6" r="1.9" fill="#e8a23f" />
      </svg>
    </span>
  );
}

/** A photo → a small JPEG data URL that stays under the server action's 1 MB limit. */
async function receiptImage(file: File): Promise<string> {
  const toUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
  for (const edge of [1400, 1000, 760]) {
    const url = await toUrl((await prepareImage(file, edge)).blob);
    if (url.length < 900_000) return url;
  }
  throw new Error("too big");
}

/**
 * Add spending: amount, what for, who paid (someone or the kitty) and who shares it.
 * Everyone on the trip is ticked to start with; the split is equal. "Scan a receipt" fills the
 * amount and shop from a photo, which is read once and not kept.
 */
export function ExpenseForm({ tripId, placeId = null, members, me, currency = "MYR", places, kitty = false, onDone, className = "" }: {
  tripId: string; placeId?: string | null; members: Person[]; me: string; currency?: string;
  places?: { id: string; name: string }[]; kitty?: boolean; onDone?: () => void; className?: string;
}) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [cur, setCur] = useState(currency);
  const [sharing, setSharing] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));
  const [scan, setScan] = useState<{ note?: string; error?: string } | null>(null);
  const [reading, startReading] = useTransition();
  const [, startSubmit] = useTransition();
  const [state, action, busy] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const r = await addExpense(tripId, placeId, prev, form);
    if (r.ok) { setAmount(""); setLabel(""); setScan(null); setSharing(new Set(members.map((m) => m.id))); onDone?.(); }
    return r;
  }, {});
  const fileRef = useRef<HTMLInputElement>(null);
  const group = members.length > 1;
  // you first, then everyone else by name, so the chips never move between visits
  const ordered = [...members].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.name.localeCompare(b.name)));

  const n = Number(amount.replace(/,/g, ""));
  const each = n > 0 && sharing.size > 0 ? n / sharing.size : null;

  function onReceipt(file: File | undefined) {
    if (!file) return;
    setScan(null);
    startReading(async () => {
      let image: string;
      try { image = await receiptImage(file); } catch { setScan({ error: "That photo couldn't be opened. Try another one." }); return; }
      const r = await scanReceipt(tripId, image, cur);
      if (r.error || !r.amount) { setScan({ error: r.error ?? "I couldn't read it. Type the amount instead." }); return; }
      setAmount(String(r.amount));
      if (r.currency) setCur(r.currency);
      if (r.shop) setLabel(r.shop);
      setScan({ note: `I read ${money(r.amount, r.currency ?? cur)}${r.shop ? ` at ${r.shop}` : ""}. Check it, then add it. I didn't keep the photo.` });
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    // submitted by hand so React doesn't reset the form: the currency and split stay as they are on screen
    <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startSubmit(() => action(data)); }} className={`rounded-[16px] bg-card p-3 shadow-card ${className}`}>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-line text-[12px] font-bold text-deep disabled:opacity-60">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3.5 1.5h9v13l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1zM5.5 5h5M5.5 7.5h5M5.5 10h3" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" /></svg>
        {reading ? "Reading the receipt…" : "Scan a receipt"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onReceipt(e.target.files?.[0])} />
      {scan?.note && (
        <p role="status" className="mt-2 flex items-center gap-2 rounded-[10px] bg-surface px-2.5 py-2 text-[11.5px] text-ink">
          <Ato size={30} mood="happy" />
          <span className="min-w-0">{scan.note}</span>
        </p>
      )}
      {scan?.error && <p role="alert" className="mt-2 text-[11.5px] text-coral-dark">{scan.error}</p>}

      <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
        <select name="currency" value={cur} onChange={(e) => setCur(e.target.value)} aria-label="Currency" className="h-10 rounded-[10px] border border-line bg-card px-2 text-[12px] text-ink">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c === "MYR" ? "RM" : c}</option>)}
        </select>
        <input name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount" aria-label="Amount" required className={box} />
        <input name="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What for?" aria-label="What for" maxLength={60} className={box} />
      </div>

      {places && (
        <select name="place_id" defaultValue="" aria-label="Where" className="mt-2 h-10 w-full rounded-[10px] border border-line bg-card px-2 text-[12px] text-ink">
          <option value="">Not at one place (stay, flights, transport)</option>
          {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}

      {group && (
        <>
          <fieldset className="mt-3">
            <legend className="mb-1.5 text-[11px] font-bold text-ink">Paid by</legend>
            <div className="flex flex-wrap gap-1.5">
              {ordered.map((m) => (
                <label key={m.id} className={chip}>
                  <input type="radio" name="paid_by" value={m.id === me ? "me" : m.id} defaultChecked={m.id === me} className="sr-only" />
                  <Avatar p={m} size={28} />{m.id === me ? "You" : shortName(m.name)}
                </label>
              ))}
              <label className={chip}>
                <input type="radio" name="paid_by" value="kitty" className="sr-only" />
                <KittyIcon />Kitty
              </label>
            </div>
            {!kitty && <p className="mt-1 text-[10.5px] text-muted">Kitty: the group&apos;s shared money. Add to it on the Money page.</p>}
          </fieldset>

          <fieldset className="mt-3">
            <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-[11px] font-bold text-ink">
              <span>Split equally with</span>
              <span className="font-medium text-muted">{each != null ? `${money(Math.round(each * 100) / 100, cur)} each` : `${sharing.size} of ${members.length}`}</span>
            </legend>
            <input type="hidden" name="share_shown" value="1" />
            <div className="flex flex-wrap gap-1.5">
              {ordered.map((m) => (
                <label key={m.id} className={chip}>
                  <input type="checkbox" name="share" value={m.id} checked={sharing.has(m.id)} className="sr-only"
                    onChange={(e) => setSharing((s) => { const next = new Set(s); if (e.target.checked) next.add(m.id); else next.delete(m.id); return next; })} />
                  <Avatar p={m} size={28} />{m.id === me ? "You" : shortName(m.name)}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {state.error && <p role="alert" className="mt-2 text-[11.5px] text-coral-dark">{state.error}</p>}
      <button disabled={busy || reading || (group && sharing.size === 0)} className="mt-3 h-10 w-full rounded-[10px] bg-deep text-[12.5px] font-bold text-white disabled:opacity-50">
        {busy ? "Adding…" : "Add expense"}
      </button>
    </form>
  );
}
