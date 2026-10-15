"use client";

import { useActionState, useState, useTransition } from "react";
import { addComment, draftNote, renamePlace, saveNote, setRating } from "@/features/places/actions";
import { Ato } from "@/components/ato";
import type { ActionResult } from "@/lib/types";

type PhotoView = { id: string; url: string | null; by: string; taken_at: string | null };

/** Photo grid plus the 11 full-screen viewer. */
export function Photos({ photos, where }: { photos: PhotoView[]; where?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  const big = photos.slice(0, 3);
  const more = photos.length - big.length;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {big.map((p, i) => (
          <button key={p.id} onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`} className="aspect-square overflow-hidden rounded-[16px] bg-surface">
            {p.url && <img src={p.url} alt={`Photo ${i + 1}, added by ${p.by}`} className="h-full w-full object-cover" />}
          </button>
        ))}
      </div>
      {more > 0 && (
        <button onClick={() => setOpen(3)} className="mt-2 w-full rounded-[14px] bg-surface py-2.5 text-[12px] font-medium text-muted">
          +{more} more photo{more === 1 ? "" : "s"}
        </button>
      )}
      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-50 flex flex-col bg-[#0a2226]">
          <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] text-white">
            <button onClick={() => setOpen(null)} aria-label="Close" className="text-[22px]">×</button>
            <span className="text-[13px] font-bold">Photo {open + 1} of {photos.length}</span>
            <span className="w-5" />
          </div>
          <div className="relative flex flex-1 items-center justify-center">
            {photos[open].url && <img src={photos[open].url!} alt={`Photo ${open + 1} of ${photos.length}, added by ${photos[open].by}`} className="max-h-full max-w-full object-contain" />}
            <button onClick={() => setOpen(Math.max(0, open - 1))} aria-label="Previous" className="absolute left-3 h-11 w-11 rounded-full bg-white/10 text-white">‹</button>
            <button onClick={() => setOpen(Math.min(photos.length - 1, open + 1))} aria-label="Next" className="absolute right-3 h-11 w-11 rounded-full bg-white/10 text-white">›</button>
          </div>
          <p className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-[12px] text-[#8fbdb8]">{where ? `${where} · ` : ""}added by {photos[open].by}</p>
        </div>
      )}
    </>
  );
}

export function RatingStars({ placeId, tripId, value, disabled }: { placeId: string; tripId: string; value: number | null; disabled?: boolean }) {
  const [stars, setStars] = useState(value ?? 0);
  const [, start] = useTransition();
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} disabled={disabled}
          onClick={() => { setStars(n); start(() => { setRating(placeId, tripId, n); }); }}
          className="grid h-11 w-10 place-items-center text-[28px] leading-none transition-transform active:scale-90 disabled:cursor-default">
          <span className={n <= stars ? "text-sand-ink" : "text-[#8aa5a1]"}>★</span>
        </button>
      ))}
      {stars > 0 && <span className="ml-2 text-[12px] text-muted">{stars}.0</span>}
    </div>
  );
}

export function NoteEditor({ placeId, tripId, initial, drafted, insights = true }: { placeId: string; tripId: string; initial: string; drafted?: boolean; insights?: boolean }) {
  const [body, setBody] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [byAto, setByAto] = useState(Boolean(drafted));
  const [busy, start] = useTransition();
  const [drafting, startDraft] = useTransition();
  return (
    <div className="rounded-[16px] bg-card p-3 shadow-card has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-coral">
      {!body && insights && (
        <button type="button" disabled={drafting} onClick={() => startDraft(async () => { await draftNote(placeId, tripId); location.reload(); })}
          className="mb-2 flex min-h-[40px] items-center gap-2 rounded-full bg-surface pl-1 pr-4 text-[12px] font-bold text-deep">
          <Ato size={34} />{drafting ? "Ato is writing…" : "Let Ato draft it"}
        </button>
      )}
      <textarea value={body} onChange={(e) => { setBody(e.target.value); setSaved(false); setByAto(false); }} rows={3} maxLength={2000}
        placeholder="What do you want to remember about this place?"
        className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-ink placeholder:text-muted focus:outline-none" />
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] text-muted">{byAto ? "Ato drafted this · tap to edit" : "Only people on this trip see notes."}</span>
        <button disabled={saved || busy} onClick={() => start(async () => { await saveNote(placeId, tripId, body); setSaved(true); })}
          className="rounded-full bg-deep px-4 py-1.5 text-[11px] font-bold text-white disabled:bg-surface disabled:text-muted">
          {busy ? "Saving…" : saved ? "Saved" : "Save note"}
        </button>
      </div>
    </div>
  );
}

export function CommentForm({ placeId, tripId }: { placeId: string; tripId: string }) {
  const [state, action, busy] = useActionState<ActionResult, FormData>(addComment.bind(null, placeId, tripId), {});
  return (
    <form action={action} className="flex items-center gap-2 rounded-full bg-card py-1.5 pl-4 pr-1.5 shadow-card has-[input:focus]:ring-2 has-[input:focus]:ring-coral">
      <input name="body" placeholder="Add to this spot…" aria-label="Comment" maxLength={2000} required
        className="h-9 flex-1 bg-transparent text-[13px] placeholder:text-muted focus:outline-none" />
      <button disabled={busy} className="h-9 shrink-0 rounded-full bg-coral px-4 text-[12px] font-bold text-white">Post</button>
      {state.error && <p role="alert" className="sr-only">{state.error}</p>}
    </form>
  );
}

export function PlaceName({ placeId, name, editable }: { placeId: string; name: string; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [, start] = useTransition();
  if (!editing) {
    return (
      <h1 className="flex items-center gap-2 text-[19px] font-bold text-ink">
        {value}
        {editable && <button onClick={() => setEditing(true)} className="text-[11px] font-bold text-coral">Rename</button>}
      </h1>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); setEditing(false); start(() => { renamePlace(placeId, value); }); }} className="flex gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={80} aria-label="Place name"
        className="h-9 flex-1 rounded-[10px] border border-coral px-3 text-[15px] font-bold text-ink focus:outline-none focus:ring-[3px] focus:ring-coral/30" />
      <button className="rounded-[10px] bg-coral px-3 text-[12px] font-bold text-white">Save</button>
    </form>
  );
}
