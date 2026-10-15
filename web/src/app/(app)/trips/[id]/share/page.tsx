import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setShareField, setTripAudience } from "@/features/trips/actions";
import { AUDIENCE_LABEL, audienceOf } from "@/lib/types";
import { BackHeader, Cover } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { getTrip } from "@/features/trips/data";
import { TWO_COLUMNS } from "@/lib/layout";

function Toggle({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-coral" : "bg-surface"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${on ? "left-6" : "left-1"}`} />
    </span>
  );
}

/** 36a Who can see this trip — only its people, friends, or everyone (Community); and which parts. Enforced by RLS. */
export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTrip(supabase, id, user.id);
  if (!t) notFound();
  if (!t.isOwner) redirect(`/trips/${id}`);
  const ss = t.trip.share_settings ?? {};
  const audience = audienceOf(t.trip);
  const on = (k: "photos" | "spend" | "comments") => ss[k] !== false;
  const owner = t.members.find((m) => m.role === "owner")?.person.name ?? "you";
  const firstThumb = Object.values(t.thumbs).find(Boolean) ?? null;
  const rows: [("photos" | "spend" | "comments"), string, string][] = [
    ["photos", "Photos and places", "Your route, photos and ratings"],
    ["spend", "What you spent", "Totals only, no receipts"],
    ["comments", "Let people comment", "Comments your group left at each place"],
  ];
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 wide:max-w-5xl wide:pt-4">
      <BackHeader href={`/trips/${id}/options`} title="Who can see this trip" />
      <div className={`space-y-5 px-6 ${TWO_COLUMNS}`}>
        <div className="overflow-hidden rounded-[20px] bg-card shadow-card">
          <Cover url={t.coverUrl ?? firstThumb} seed={id} className="h-32 w-full" />
          <div className="px-4 py-3">
            <p className="text-[15px] font-bold text-ink">{t.trip.name}</p>
            <p className="text-[11px] text-muted">by {owner} · {t.places.length} places</p>
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-[11px] font-bold text-ink">Who can see it</h2>
          <ul className="divide-y divide-line rounded-[18px] bg-card shadow-card">
            {(["private", "friends", "public"] as const).map((a) => {
              const chosen = audience === a;
              return (
                <li key={a}>
                  <form action={async () => { "use server"; await setTripAudience(id, a); }}>
                    <button aria-pressed={chosen} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                      <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${chosen ? "border-coral" : "border-line"}`}>
                        {chosen && <span className="h-2.5 w-2.5 rounded-full bg-coral" />}
                      </span>
                      <span><span className={`block text-[13px] ${chosen ? "font-bold text-ink" : "font-medium text-ink"}`}>{AUDIENCE_LABEL[a].title}</span><span className="block text-[10.5px] text-muted">{AUDIENCE_LABEL[a].hint}</span></span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          {audience === "public" && <Link href={`/community/${id}`} className="mt-2 inline-block min-h-[36px] content-center text-[12px] font-bold text-coral">See it in Community →</Link>}
        </section>

        <section className={audience === "private" ? "opacity-60" : ""}>
          <h2 className="mb-2 text-[11px] font-bold text-ink">What {audience === "friends" ? "your friends" : "others"} will see</h2>
          {audience === "private" && <p className="-mt-1 mb-2 text-[11px] text-muted">Applies when you share with friends or everyone.</p>}
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

      </div>
    </main>
  );
}
