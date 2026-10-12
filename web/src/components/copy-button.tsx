"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-live="polite"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ } }}
      className="min-h-[40px] rounded-full bg-surface px-4 text-[12px] font-bold text-deep">
      {done ? "Copied" : label}
    </button>
  );
}
