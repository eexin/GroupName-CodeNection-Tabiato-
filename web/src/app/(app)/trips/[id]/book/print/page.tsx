import { RouteSketch } from "@/components/route-sketch";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ato } from "@/components/ato";
import { requireUser } from "@/features/auth/guards";
import type { BookContent } from "@/features/memory-book/types";
import { signedUrls } from "@/lib/storage";
import { formatRange } from "@/lib/time";
import { PrintButton } from "@/app/(app)/trips/[id]/book/print/print-button";

/**
 * 36b Export as PDF. A print-ready layout; "Save as PDF" uses the browser's own print-to-PDF,
 * so there is no server-side PDF service to host or pay for.
 */
export default async function PrintBookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cover?: string; photos?: string; route?: string; spend?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const inc = { cover: sp.cover !== "0", photos: sp.photos !== "0", route: sp.route !== "0", spend: sp.spend !== "0" };
  const withPhotos = inc.photos, withSpend = inc.spend;
  const { supabase } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const { data: book } = await supabase.from("memory_books").select("content").eq("trip_id", id).maybeSingle();
  if (!book) redirect(`/trips/${id}/book`);
  const c = book.content as BookContent;
  const urls = withPhotos ? await signedUrls(supabase, c.pages.map((p) => p.photo_path).filter((x): x is string => Boolean(x))) : {};
  const q = (k: keyof typeof inc) => "?" + (Object.keys(inc) as (keyof typeof inc)[]).map((x) => `${x}=${(x === k ? !inc[x] : inc[x]) ? 1 : 0}`).join("&");
  const { data: route } = inc.route ? await supabase.from("places").select("name, lat, lng").eq("trip_id", id).order("first_seen_at") : { data: [] };
  const pageCount = (inc.cover ? 1 : 0) + c.pages.length + 1 + (inc.route && (route ?? []).length > 1 ? 1 : 0);

  return (
    <main className="mx-auto max-w-[720px] bg-white print:max-w-none">
      <style>{`@page { size: A5; margin: 14mm; } @media print { body { background: #fff !important; } .sheet { break-after: page; } }`}</style>

      <div className="space-y-3 px-6 py-6 print:hidden">
        <Link href={`/trips/${id}/book`} className="text-[13px] font-bold text-coral">‹ Back to the book</Link>
        <h1 className="text-[20px] font-bold text-ink">Export as PDF</h1>
        <h2 className="text-[11px] font-bold text-ink">Include</h2>
        <div className="flex flex-wrap gap-2">
          {([["cover", "Cover and trip story"], ["photos", "Photo pages"], ["route", "Route map"], ["spend", "Spending breakdown"]] as const).map(([k, label]) => (
            <Link key={k} href={q(k)} aria-pressed={inc[k]} className={`min-h-[40px] content-center rounded-full px-4 text-[12px] font-medium ${inc[k] ? "bg-coral text-white" : "border border-line text-body"}`}>
              {inc[k] ? "✓ " : ""}{label}
            </Link>
          ))}
        </div>
        <p className="text-[11.5px] text-muted">{pageCount} pages. On your phone, choose &ldquo;Save to Files&rdquo; or &ldquo;Save as PDF&rdquo; in the print screen.</p>
        <PrintButton />
      </div>

      {inc.cover && <section className="sheet flex min-h-[180mm] flex-col items-center justify-center bg-[#0e4c55] p-10 text-center text-white print:min-h-[180mm]">
        <Ato size={140} />
        <h2 className="mt-6 text-[34px] font-bold uppercase text-[#f6e7b8]">{c.title}</h2>
        <p className="mt-2 text-[14px] text-[#bfe4e0]">{formatRange(trip.start_date, trip.end_date)}</p>
        <p className="mt-1 text-[12px] text-[#8fbdb8]">{c.subtitle}</p>
        <p className="mt-8 text-[10px] text-[#e8a23f]">a Tabiato memory book, written by Ato</p>
      </section>}

      {inc.route && (route ?? []).length > 1 && (
        <section className="sheet p-10">
          <p className="text-[10px] font-bold text-[#86570f]">THE ROUTE</p>
          <div className="mt-4"><RouteSketch points={route ?? []} width={480} height={300} /></div>
          <ol className="mt-4 columns-2 text-[11.5px] text-[#3d3627]">{(route ?? []).map((p, i) => <li key={i}>{i + 1}. {p.name}</li>)}</ol>
        </section>
      )}

      {c.pages.map((p) => (
        <section key={p.place_id} className="sheet p-10">
          <p className="text-[10px] font-bold uppercase text-sand-ink">{p.day}</p>
          <h3 className="mt-1 text-[24px] font-bold leading-tight text-[#12312f]">{p.heading}</h3>
          {withPhotos && p.photo_path && urls[p.photo_path] && (
            <img src={urls[p.photo_path]} alt="" className="mt-4 aspect-[3/2] w-full rounded-[10px] object-cover" />
          )}
          <p className="mt-4 text-[13px] leading-relaxed text-[#3d3627]">{p.body}</p>
          {p.rating !== null && <p className="mt-3 text-[11px] text-[#e8a23f]">Rated {p.rating}★</p>}
        </section>
      ))}

      <section className="sheet p-10">
        <p className="text-[10px] font-bold text-sand-ink">WHAT ATO NOTICED</p>
        <ul className="mt-3 space-y-2 text-[13px] text-[#3d3627]">
          {c.observations.map((o) => <li key={o}>• {o}</li>)}
        </ul>
        {withSpend && c.spendByCategory.length > 0 && (
          <>
            <p className="mt-6 text-[10px] font-bold text-sand-ink">WHERE THE MONEY WENT — RM {c.totals.spend.toFixed(0)}</p>
            <ul className="mt-2 space-y-1 text-[12.5px] text-[#3d3627]">
              {c.spendByCategory.map((s) => <li key={s.label}>{s.label}: {Math.round(s.share * 100)}%</li>)}
            </ul>
          </>
        )}
        <p className="mt-8 text-[14px] italic text-[#12312f]">{c.closing}</p>
      </section>
    </main>
  );
}
