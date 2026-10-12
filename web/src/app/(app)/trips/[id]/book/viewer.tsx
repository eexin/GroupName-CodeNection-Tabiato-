"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { generateMemoryBook } from "@/features/memory-book/actions";
import { Ato } from "@/components/ato";
import type { BookContent } from "@/features/memory-book/types";
import { ShareButton } from "@/components/share-button";

/** 26 cover and 27 pages. Swipe or use the arrows. */
export function BookViewer({ tripId, book, urls, subtitle, withNames, canShare }: { tripId: string; book: BookContent; urls: Record<string, string>; subtitle: string; withNames: string | null; canShare: boolean }) {
  const [page, setPage] = useState(-1); // -1 is the cover
  const [rewriting, setRewriting] = useState(false);
  const touch = useRef<number | null>(null);
  const last = book.pages.length - 1;
  const go = (n: number) => setPage(Math.max(-1, Math.min(last + 1, n)));

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touch.current === null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    if (Math.abs(dx) > 50) go(page + (dx < 0 ? 1 : -1));
    touch.current = null;
  };

  async function rewrite() {
    setRewriting(true);
    await generateMemoryBook(tripId);
    location.reload();
  }

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-deeper px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)} onTouchEnd={onTouchEnd}>
      <div className="flex items-center justify-between px-2 pb-3">
        <Link href={`/trips/${tripId}`} className="min-h-[40px] content-center text-[13px] font-bold text-[#8fbdb8]">Close</Link>
        <span className="text-[11px] text-[#8fbdb8]">{page < 0 ? "Cover" : page > last ? "The end" : `Page ${page + 1} of ${book.pages.length}`}</span>
        {canShare && <ShareButton path={`/trips/${tripId}/book`} title={`${book.title} — a Tabiato memory book`} className="bg-white/15 text-white" />}
      </div>
      {children}
      <div className="mt-4 flex items-center justify-between px-2">
        <button onClick={() => go(page - 1)} disabled={page < 0} aria-label="Previous page" className="h-11 w-11 rounded-full bg-white/10 text-white disabled:opacity-30">‹</button>
        <div className="flex gap-1.5" aria-hidden>
          {[-1, ...book.pages.map((_, i) => i), last + 1].map((i) => (
            <span key={i} className={`h-1.5 rounded-full ${i === page ? "w-4 bg-white" : "w-1.5 bg-white/30"}`} />
          ))}
        </div>
        <button onClick={() => go(page + 1)} disabled={page > last} aria-label="Next page" className="h-11 w-11 rounded-full bg-white/10 text-white disabled:opacity-30">›</button>
      </div>
    </main>
  );

  if (page < 0) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative w-[78%] rounded-[14px] bg-gradient-to-br from-[#1b7a80] to-deeper p-6 text-center shadow-sheet">
          <span className="absolute inset-y-0 left-0 w-3 rounded-l-[14px] bg-black/25" />
          <div className="rounded-[8px] border border-sand/70 px-4 py-6">
            <Ato size={120} className="mx-auto" />
            <h1 className="mt-4 text-[26px] font-bold uppercase leading-tight text-[#f6e7b8]">{book.title}</h1>
            <div className="mx-auto my-3 h-px w-12 bg-sand" />
            <p className="text-[12px] text-aqua-light">{subtitle}</p>
            {withNames && <p className="mt-1 text-[11px] text-[#bfe4e0]">{withNames}</p>}
            <p className="mt-4 text-[10px] text-sand">a Tabiato memory book</p>
          </div>
        </div>
        <p className="mt-6 text-[12.5px] text-aqua-light">Written by Ato from your trip</p>
        <dl className="mt-3 grid w-[78%] grid-cols-3 rounded-[16px] bg-white/10 py-3 text-center text-white">
          {[[book.totals.photos, "photos"], [book.totals.places, "places"], [book.pages.length, "pages"]].map(([n, l]) => (
            <div key={l}><dd className="text-[17px] font-bold">{n}</dd><dt className="text-[10px] text-[#8fbdb8]">{l}</dt></div>
          ))}
        </dl>
        <button onClick={() => go(0)} className="mt-6 h-12 w-[78%] rounded-[15px] bg-coral text-[15px] font-bold text-white">Open the book</button>
      </div>,
    );
  }

  if (page > last) {
    return shell(
      <article className="flex flex-1 flex-col rounded-[18px] bg-[#fbf3e4] p-6">
        <p className="text-[10px] font-bold text-sand-ink">What Ato noticed</p>
        <ul className="mt-3 space-y-3">
          {book.observations.length
            ? book.observations.map((o) => <li key={o} className="flex gap-3 text-[13px] leading-snug text-[#3d3627]"><Ato size={36} />{o}</li>)
            : <li className="text-[13px] text-[#3d3627]">Log a few more ratings next time and I&apos;ll have patterns to show you.</li>}
        </ul>
        {book.spendByCategory.length > 0 && (
          <>
            <p className="mt-6 text-[10px] font-bold text-sand-ink">Where the money went — RM {book.totals.spend.toFixed(0)}</p>
            <ul className="mt-2 space-y-1.5">
              {book.spendByCategory.map((s) => (
                <li key={s.label} className="flex justify-between text-[12.5px] text-[#3d3627]"><span>{s.label}</span><span>{Math.round(s.share * 100)}%</span></li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-auto pt-6 text-[14px] font-medium italic leading-relaxed text-[#12312f]">{book.closing}</p>
        <Link href={`/trips/${tripId}/book/print`} className="mt-5 block text-center text-[12px] font-bold text-deep">Export as PDF</Link>
        <button onClick={rewrite} disabled={rewriting} className="mt-3 text-[12px] font-bold text-sand-ink">
          {rewriting ? "Rewriting…" : "Rewrite the book"}
        </button>
      </article>,
    );
  }

  const p = book.pages[page];
  const url = p.photo_path ? urls[p.photo_path] : null;
  return shell(
    <article className="flex flex-1 flex-col rounded-[18px] bg-[#fbf3e4] p-6">
      <p className="text-[10px] font-bold uppercase text-sand-ink">{p.day}</p>
      <h2 className="mt-1 text-[25px] font-bold leading-tight text-[#12312f]">{p.heading}</h2>
      {url ? <img src={url} alt={p.heading} className="mt-4 aspect-[3/2] w-full rounded-[12px] object-cover" /> : <div className="mt-4 aspect-[3/2] w-full rounded-[12px] bg-[#dcd0b6]" />}
      <p className="mt-4 text-[14px] leading-relaxed text-[#3d3627]">{p.body}</p>
      {p.rating !== null && <p className="mt-auto pt-4 text-[12px] font-medium text-sand-ink">You rated it {p.rating}★</p>}
    </article>,
  );
}
