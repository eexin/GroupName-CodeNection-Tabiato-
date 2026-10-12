"use client";

import { useState } from "react";

/** Native share sheet on phones; copies the link everywhere else. */
export function ShareButton({ path, title, className = "" }: { path: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${location.origin}${path}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* user closed the share sheet */ }
  }
  return (
    <button type="button" onClick={share} aria-live="polite" className={`min-h-[40px] rounded-full px-4 text-[12.5px] font-bold ${className}`}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
