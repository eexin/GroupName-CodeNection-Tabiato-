import Link from "next/link";
import { Ato } from "@/components/ato";
import type { Person } from "@/lib/people";

export function BackHeader({ href, title, subtitle, right }: { href: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-start gap-3 px-6 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Link href={href} aria-label="Back" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center">
        <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden>
          <path d="M9 13 3 7 9 1" fill="none" stroke="#12312F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <div className="min-w-0 flex-1 pt-1.5">
        <h1 className="truncate text-[17px] font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-[11.5px] text-muted">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 pt-1">{right}</div>}
    </header>
  );
}

const variants = {
  primary: "bg-coral text-white",
  deep: "bg-deep text-white",
  outline: "border border-coral bg-card text-coral",
  quiet: "bg-surface text-deep",
  danger: "bg-coral-dark text-white",
};
export type Variant = keyof typeof variants;
export const buttonClass = (v: Variant = "primary", extra = "") =>
  `flex h-[52px] w-full items-center justify-center rounded-[15px] text-[15px] font-bold transition-opacity disabled:opacity-50 ${variants[v]} ${extra}`;

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: Variant }) {
  return <Link href={href} className={buttonClass(variant)}>{children}</Link>;
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-muted">{label}</span>
      <input
        {...rest}
        className="h-[50px] w-full rounded-[14px] border border-line bg-card px-4 text-[14px] text-ink placeholder:text-muted focus:border-coral focus:outline-none"
      />
    </label>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[18px] bg-card shadow-card ${className}`}>{children}</div>;
}

export function AtoNote({ label = "Ato noticed", children, mood }: { label?: string; children: React.ReactNode; mood?: "open" | "happy" | "rest" }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border-l-4 border-coral bg-card p-4 shadow-card">
      <Ato size={52} mood={mood} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-coral">{label}</p>
        <div className="mt-0.5 text-[12px] leading-snug text-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
      <Ato size={96} mood="rest" />
      <h2 className="text-[18px] font-bold text-ink">{title}</h2>
      <p className="text-[12.5px] leading-relaxed text-muted">{children}</p>
      {action && <div className="mt-2 w-full max-w-[240px]">{action}</div>}
    </div>
  );
}

export function Avatars({ people, size = 22 }: { people: Person[]; size?: number }) {
  return (
    <div className="flex -space-x-1.5" aria-label={people.map((p) => p.name).join(", ")}>
      {people.slice(0, 4).map((p) => (
        p.avatar
          ? <img key={p.id} src={p.avatar} alt={p.name} title={p.name} width={size} height={size} className="rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />
          : <span key={p.id} title={p.name} className="grid place-items-center rounded-full font-bold text-white ring-2 ring-white"
              style={{ width: size, height: size, background: p.color, fontSize: size * 0.4 }}>
              {p.initials}
            </span>
      ))}
    </div>
  );
}

export function Avatar({ p, size = 38 }: { p: Person; size?: number }) {
  if (p.avatar) return <img src={p.avatar} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: p.color, fontSize: size * 0.32 }}>
      {p.initials}
    </span>
  );
}

export function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  if (value === null) return null;
  return <span className="text-[11.5px] font-medium text-sand-ink" aria-label={`Rated ${value.toFixed(1)} out of 5`} style={{ fontSize: size * 0.82 }}>{value.toFixed(1)}★</span>;
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-baseline justify-between">
      <h2 className="text-[11px] font-bold text-ink">{children}</h2>
      {right}
    </div>
  );
}

export function Cover({ url, seed, className = "" }: { url: string | null; seed: string; className?: string }) {
  const tones = [["#F6C89F", "#0E4C55"], ["#BFE4E0", "#0E4C55"], ["#F9AE8C", "#0E4C55"], ["#C9DFB8", "#0E4C55"], ["#DCE9F5", "#5C7FA8"]];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = tones[h % tones.length];
  return url
    ? <img src={url} alt="" className={`object-cover ${className}`} />
    : <span className={`block ${className}`} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />;
}

export function Fab({ href, label, icon = "plus" }: { href: string; label: string; icon?: "plus" | "camera" }) {
  return (
    <Link href={href} aria-label={label}
      className="fixed bottom-[92px] right-[max(1.25rem,calc(50%-215px+1.25rem))] z-30 grid h-14 w-14 lg:hidden place-items-center rounded-full bg-coral shadow-fab transition-transform active:scale-95">
      {icon === "plus" ? (
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden><path d="M11 4v14M4 11h14" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" /></svg>
      ) : (
        <svg width="24" height="22" viewBox="0 0 24 22" aria-hidden>
          <path d="M1 4.6h3.6l1.6-2.4h7.6l1.6 2.4H19c.6 0 1 .5 1 1v11c0 .6-.4 1-1 1H1c-.6 0-1-.4-1-1v-11c0-.5.4-1 1-1Z" fill="none" stroke="#fff" strokeWidth={1.8} transform="translate(2 1)" />
          <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth={1.8} />
        </svg>
      )}
    </Link>
  );
}
