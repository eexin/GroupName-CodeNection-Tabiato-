import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getPlace } from "@/features/trips/data";
import { formatDay, formatTime } from "@/lib/time";
import { currencyForCountry, money, myr } from "@/lib/currency";
import { CommentForm, DeleteExpense, ExpenseForm, NoteEditor, PlaceName, Photos, RatingStars } from "@/app/(app)/places/[id]/islands";

function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-[11px] font-bold text-ink">{children}</h2>;
}

/** 10 Location Detail — the unit the whole product is built on. */
export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const d = await getPlace(supabase, id, user.id);
  if (!d) notFound();
  const { place, trip } = d;
  const when = place.first_seen_at
    ? `${formatDay(place.first_seen_at)}, ${formatTime(place.first_seen_at)}${place.last_seen_at && place.last_seen_at !== place.first_seen_at ? ` – ${formatTime(place.last_seen_at)}` : ""}`
    : "No time recorded";
  const spend = d.expenses.reduce((s, e) => s + myr(e), 0);
  const { data: me } = await supabase.from("profiles").select("settings").eq("id", user.id).single();

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 px-6 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-start gap-3">
        <Link href={`/trips/${trip.id}`} aria-label="Back to trip" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center">
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden><path d="M9 13 3 7 9 1" fill="none" stroke="#12312F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <div className="min-w-0 flex-1 pt-1">
          <PlaceName placeId={place.id} name={place.name} editable={d.isMember} />
          <p className="text-[11.5px] text-muted">{d.photos.length} photos, {when}</p>
          {d.with.length > 0 && <p className="mt-0.5 text-[11.5px] text-body">With {d.with.map((p) => p.name.split(" ")[0]).join(", ")}</p>}
        </div>
      </div>

      <div className="mt-4"><Photos photos={d.photos} where={[place.name, trip.destination].filter(Boolean).join(", ")} /></div>

      {d.isMember && (
        <>
          <Label>Spent here</Label>
          {d.expenses.length > 0 && (
            <ul className="space-y-2">
              {d.expenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-[14px] bg-card px-4 py-3 shadow-card">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-surface text-[15px] font-bold text-coral">$</span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-bold text-ink">
                      {money(Number(e.amount), e.currency)}
                      {e.currency !== "MYR" && <span className="ml-1.5 text-[11px] font-medium text-muted">{e.amount_myr != null ? `≈ ${money(Number(e.amount_myr))}` : "rate unavailable"}</span>}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {e.label || "Expense"}{e.split_count > 1 ? `, split ${e.split_count} ways (${money(Number(e.amount) / e.split_count, e.currency)} each)` : ""}
                    </span>
                  </span>
                  <DeleteExpense id={e.id} placeId={place.id} />
                </li>
              ))}
              {d.expenses.length > 1 && <li className="px-1 text-right text-[11px] text-muted">Total RM {spend.toFixed(2)}</li>}
            </ul>
          )}
          <ExpenseForm placeId={place.id} tripId={trip.id} currency={currencyForCountry(trip.country_code)} />

          <Label>Your rating</Label>
          <RatingStars placeId={place.id} tripId={trip.id} value={d.myRating} />
          {d.avgRating !== null && d.avgRating !== d.myRating && <p className="mt-1 text-[11px] text-muted">Everyone: {d.avgRating}★</p>}

          <Label>Your notes</Label>
          <NoteEditor placeId={place.id} tripId={trip.id} initial={d.myNote?.body ?? ""} drafted={d.myNote?.ai_drafted} insights={me?.settings?.ato_insights !== false} />
          {d.otherNotes.map((n) => (
            <p key={n.user_id} className="mt-2 rounded-[14px] bg-surface px-4 py-3 text-[12.5px] text-body">
              <strong className="block text-[11px] text-ink">{n.by}</strong>{n.body}
            </p>
          ))}
        </>
      )}

      <Label>Comments {d.comments.length > 0 && <span className="font-normal text-muted">({d.comments.length})</span>}</Label>
      <ul className="space-y-3">
        {d.comments.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <Avatar p={c.person} size={32} />
            <p className="rounded-[16px] rounded-tl-[4px] bg-card px-4 py-2.5 text-[12.5px] text-body shadow-card">
              <strong className="block text-[12px] text-ink">{c.person.name}</strong>{c.body}
            </p>
          </li>
        ))}
        {!d.comments.length && <li className="text-[12px] text-muted">No comments yet.</li>}
      </ul>

      {d.isMember && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[430px] lg:sticky lg:max-w-none bg-gradient-to-t from-paper via-paper to-transparent px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
          <CommentForm placeId={place.id} tripId={trip.id} />
        </div>
      )}
    </main>
  );
}
