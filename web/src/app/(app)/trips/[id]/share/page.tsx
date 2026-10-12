import { notFound, redirect } from "next/navigation";
import { setShareField, setTripPublic } from "@/features/trips/actions";
import { BackHeader, Cover } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getTrip } from "@/features/trips/data";

function Toggle({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-coral" : "bg-surface"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${on ? "left-6" : "left-1"}`} />
    </span>
  );
}

/** 36a Share to Community — preview, what others will see (enforced by RLS), and the switch. */
export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTrip(supabase, id, user.id);
  if (!t) notFound();
  if (!t.isOwner) redirect(`/trips/${id}`);
  const ss = t.trip.share_settings ?? {};
  const on = (k: "photos" | "spend" | "comments") => ss[k] !== false;
  const owner = t.members.find((m) => m.role === "owner")?.person.name ?? "you";
  const firstThumb = Object.values(t.thumbs).find(Boolean) ?? null;
  const rows: [("photos" | "spend" | "comments"), string, string][] = [
    ["photos", "Photos and places", "Your route, photos and ratings"],
    ["spend", "What you spent", "Totals only, no receipts"],
    ["comments", "Let people comment", "Comments your group left at each place"],
  ];
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 lg:max-w-2xl lg:pt-4">
      <BackHeader href={`/trips/${id}/options`} title="Share to Community" />
      <div className="space-y-5 px-6">
        <div className="overflow-hidden rounded-[20px] bg-card shadow-card">
          <Cover url={t.coverUrl ?? firstThumb} seed={id} className="h-32 w-full" />
          <div className="px-4 py-3">
            <p className="text-[15px] font-bold text-ink">{t.trip.name}</p>
            <p className="text-[11px] text-muted">by {owner} · {t.places.length} places</p>
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-[11px] font-bold text-ink">What others will see</h2>
          <ul className="divide-y divide-line rounded-[18px] bg-card shadow-card">
            {rows.map(([field, label, hint]) => {
              const isOn = on(field); // a plain boolean: inline server actions can only capture serialisable values
              return (
                <li key={field}>
                  <form action={async () => {
                    "use server";
                    await setShareField(id, field, !isOn);
                    if (field === "photos") await setShareField(id, "ratings", !isOn); // ratings travel with the photos
                  }}>
                    <button aria-pressed={isOn} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
                      <span><span className="block text-[13px] font-medium text-ink">{label}</span><span className="block text-[10.5px] text-muted">{hint}</span></span>
                      <Toggle on={isOn} />
                    </button>
                  </form>
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-3 px-4 py-3.5 opacity-70">
              <span><span className="block text-[13px] font-medium text-ink">Your notes</span><span className="block text-[10.5px] text-muted">Keep these private — always</span></span>
              <Toggle on={false} />
            </li>
          </ul>
        </section>

        {(() => { const isPublic = t.trip.is_public; return (
        <form action={async () => { "use server"; await setTripPublic(id, !isPublic); redirect(isPublic ? `/trips/${id}/share` : `/community/${id}`); }}>
          <button className={`h-[52px] w-full rounded-[15px] text-[15px] font-bold ${t.trip.is_public ? "bg-surface text-deep" : "bg-coral text-white"}`}>
            {isPublic ? "Stop sharing" : "Share to Community"}
          </button>
        </form>); })()}
      </div>
    </main>
  );
}
