import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getPlace } from "@/features/trips/data";
import { formatDay, formatTime } from "@/lib/time";
import { currencyForCountry, money, myr } from "@/lib/currency";
import { CommentForm, NoteEditor, PlaceName, Photos, RatingStars } from "@/app/(app)/places/[id]/islands";
import { ExpenseForm, KittyIcon } from "@/features/money/components/expense-form";
import { Remove } from "@/features/money/components/islands";
import { shortName } from "@/lib/people";
import { PersonLink } from "@/components/ui";

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
    <main className="mx-auto min-h-dvh max-w-[430px] px-6 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))] wide:max-w-5xl wide:pb-10 wide:pt-4">
      <div className="flex items-start gap-3">
        <Link href={`/trips/${trip.id}`} aria-label="Back to trip" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center">
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden><path d="M9 13 3 7 9 1" fill="none" stroke="#12312F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <div className="min-w-0 flex-1 pt-1">
          <PlaceName placeId={place.id} name={place.name} editable={d.isMember} />
          <p className="text-[11.5px] text-muted">{d.photos.length} photos, {when}</p>
          {d.with.length > 0 && <p className="mt-0.5 text-[11.5px] text-body">With {d.with.map((p) => shortName(p.name)).join(", ")}</p>}
        </div>
      </div>

      {/* phone: photos, your part, comments · wide: photos and comments on the left, your part on the right */}
      <div className="grid [grid-template-areas:'photos'_'mine'_'talk'] wide:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] wide:items-start wide:gap-x-8 wide:[grid-template-areas:'photos_mine'_'talk_mine']">
      <div className="mt-4 [grid-area:photos]"><Photos photos={d.photos} where={[place.name, trip.destination].filter(Boolean).join(", ")} /></div>

      {d.isMember && (
        <div className="[grid-area:mine] wide:mt-4">
          <div className="mb-2 mt-6 flex wide:mt-0 items-baseline justify-between gap-3">
            <h2 className="text-[11px] font-bold text-ink">Spent here</h2>
            <Link href={`/trips/${trip.id}/money`} className="text-[11px] font-bold text-coral">Trip money</Link>
          </div>
          {d.expenses.length > 0 && (
            <ul className="space-y-2">
              {d.expenses.map((e) => {
                const by = e.from_kitty ? "From the kitty" : `${e.paid_by === user.id ? "You" : shortName(d.payer(e.paid_by).name)} paid`;
                return (
                  <li key={e.id} className="flex items-center gap-3 rounded-[14px] bg-card py-3 pl-4 pr-1 shadow-card">
                    {e.from_kitty ? <KittyIcon size={36} /> : <Avatar p={d.payer(e.paid_by)} size={36} />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-ink">
                        {money(Number(e.amount), e.currency)}
                        {e.currency !== "MYR" && <span className="ml-1.5 text-[11px] font-medium text-muted">{e.amount_myr != null ? `≈ ${money(Number(e.amount_myr))}` : "rate unavailable"}</span>}
                      </span>
                      <span className="block text-[11px] leading-snug text-muted">
                        {e.label || "Expense"} · {by}{e.split_count > 1 ? `, split ${e.split_count} ways (${money(Math.round((Number(e.amount) / e.split_count) * 100) / 100, e.currency)} each)` : ""}
                      </span>
                    </span>
                    <Remove kind="expense" id={e.id} tripId={trip.id} placeId={place.id} label={`Remove ${e.label || "expense"}`} />
                  </li>
                );
              })}
              {d.expenses.length > 1 && <li className="px-1 text-right text-[11px] text-muted">Total RM {spend.toFixed(2)}</li>}
            </ul>
          )}
          <ExpenseForm className="mt-2" tripId={trip.id} placeId={place.id} members={d.members} me={user.id} currency={currencyForCountry(trip.country_code)} />

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
        </div>
      )}

      <section className="[grid-area:talk]">
      <Label>Comments {d.comments.length > 0 && <span className="font-normal text-muted">({d.comments.length})</span>}</Label>
      <ul className="space-y-3">
        {d.comments.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <PersonLink id={c.person.id} label={`${c.person.name}'s profile`} className="shrink-0"><Avatar p={c.person} size={32} /></PersonLink>
            <p className="rounded-[16px] rounded-tl-[4px] bg-card px-4 py-2.5 text-[12.5px] text-body shadow-card">
              <PersonLink id={c.person.id} className="block text-[12px] font-bold text-ink">{c.person.name}</PersonLink>{c.body}
            </p>
          </li>
        ))}
        {!d.comments.length && <li className="text-[12px] text-muted">No comments yet.</li>}
      </ul>

      {/* phone: pinned to the bottom · wide: right under the comments, so it never covers anything */}
      {d.isMember && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] bg-gradient-to-t from-paper via-paper to-transparent px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 wide:static wide:mt-4 wide:max-w-none wide:bg-none wide:p-0">
          <CommentForm placeId={place.id} tripId={trip.id} />
        </div>
      )}
      </section>
      </div>
    </main>
  );
}
