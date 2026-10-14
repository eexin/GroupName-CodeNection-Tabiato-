import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/features/auth/guards";
import type { BookContent } from "@/features/memory-book/types";
import { signedUrls } from "@/lib/storage";
import { formatRange } from "@/lib/time";
import { Generating } from "@/app/(app)/trips/[id]/book/generating";
import { BookViewer } from "@/app/(app)/trips/[id]/book/viewer";
import { shortName } from "@/lib/people";

/** 25b generating → 26 cover → 27 pages. */
// clustering names new places via Nominatim at 1 request/second; the AI book can take a few seconds
export const maxDuration = 60;

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const { data: me } = await supabase.from("trip_members").select("status").eq("trip_id", id).eq("user_id", user.id).maybeSingle();
  const { data: book } = await supabase.from("memory_books").select("content").eq("trip_id", id).maybeSingle();

  if (!book) {
    if (me?.status !== "joined" || trip.status !== "finished") redirect(`/trips/${id}`);
    return <Generating tripId={id} tripName={trip.name} />;
  }
  const content = book.content as BookContent;
  const urls = await signedUrls(supabase, content.pages.map((p) => p.photo_path).filter((x): x is string => Boolean(x)));
  const { data: members } = await supabase.from("trip_members").select("user_id").eq("trip_id", id).eq("status", "joined").neq("user_id", user.id);
  const { data: names } = members?.length
    ? await supabase.from("profiles").select("display_name").in("id", members.map((m) => m.user_id))
    : { data: [] as { display_name: string }[] };
  const first = (names ?? []).map((n) => shortName(n.display_name)).filter(Boolean);
  const withNames = first.length ? `with ${first.length > 1 ? `${first.slice(0, -1).join(", ")} & ${first.at(-1)}` : first[0]}` : null;
  return <BookViewer tripId={id} book={content} urls={urls} subtitle={formatRange(trip.start_date, trip.end_date)} withNames={withNames} canShare={trip.is_public} />;
}
