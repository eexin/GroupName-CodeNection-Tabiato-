"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "tabiato-recent-searches";
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };

/** Figma 12 "RECENT" — kept on this device only. */
export function RecentSearches() {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => { const t = setTimeout(() => setItems(read()), 0); return () => clearTimeout(t); }, []);
  if (!items.length) return null;
  return (
    <>
      <h2 className="mb-2 mt-6 flex justify-between text-[11px] font-bold text-ink">Recent
        <button onClick={() => { try { localStorage.removeItem(KEY); } catch {} setItems([]); }} className="text-[11px] font-bold text-muted">Clear</button>
      </h2>
      <ul className="space-y-2">{items.map((s) => <li key={s}><Link href={`/search?q=${encodeURIComponent(s)}`} className="block rounded-[14px] bg-card px-4 py-3 text-[13px] text-body shadow-card">{s}</Link></li>)}</ul>
    </>
  );
}

/** Remembers a search once its results are shown. */
export function RememberSearch({ q }: { q: string }) {
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify([q, ...read().filter((x) => x !== q)].slice(0, 5))); } catch {}
  }, [q]);
  return null;
}
