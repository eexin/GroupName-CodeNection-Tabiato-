"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, type Variant } from "@/components/ui";

export function Submit({ children, pending, variant = "primary" }: { children: React.ReactNode; pending?: string; variant?: Variant }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} className={buttonClass(variant)}>
      {busy ? pending ?? "Saving…" : children}
    </button>
  );
}

/**
 * A small button inside a form that shows it heard you. Without this an icon button sits there
 * looking untouched while the server action and the re-render go round, which reads as a dead tap.
 */
export function IconSubmit({ children, label, className, disabled }: {
  children: React.ReactNode; label: string; className: string; disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-label={label} aria-busy={pending} disabled={pending || disabled}
      className={`${className} transition-opacity ${pending ? "opacity-40" : ""} disabled:opacity-25`}>
      {children}
    </button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) return <p role="alert" className="rounded-[12px] bg-[#fff3e2] px-4 py-3 text-[12.5px] text-[#8e3f13]">{error}</p>;
  if (message) return <p role="status" className="rounded-[12px] bg-surface px-4 py-3 text-[12.5px] text-deep">{message}</p>;
  return null;
}
