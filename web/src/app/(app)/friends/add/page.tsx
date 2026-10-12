import { respondToFriend, sendFriendRequest } from "@/features/friends/actions";
import { travelledWith } from "@/features/friends/data";
import { profileLink, qrSvg } from "@/features/friends/link";
import { AtoNote, Avatar, BackHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { requireUser } from "@/features/auth/guards";
import { QrScanner } from "@/features/friends/components/qr-scanner";
import { person } from "@/lib/people";

/** 22c Add friend — by @username, exact email or name; your link and QR; people you travelled with. */
export default async function AddFriendPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { supabase, user } = await requireUser();
  const term = q.trim();
  const clean = term.replace(/[%_,()]/g, "");
  const [{ data: me }, { data: rel }, exact, byName, met] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase.from("friendships").select("*"),
    term.length >= 3 ? supabase.rpc("find_profile", { q: term }) : Promise.resolve({ data: [] }),
    clean.length >= 2 && !term.includes("@")
      ? supabase.from("profiles").select("id, display_name, username").ilike("display_name", `%${clean}%`).neq("id", user.id).limit(20)
      : Promise.resolve({ data: [] }),
    travelledWith(supabase, user.id),
  ]);
  const found = new Map<string, { id: string; display_name: string }>();
  for (const p of [...((exact.data as { id: string; display_name: string }[]) ?? []), ...((byName.data as { id: string; display_name: string }[]) ?? [])]) found.set(p.id, p);
  const status = new Map<string, string>();
  for (const f of rel ?? []) {
    const other = f.requester === user.id ? f.addressee : f.requester;
    status.set(other, f.status === "accepted" ? "Friends" : f.requester === user.id ? "Requested" : "Sent you a request");
  }
  const link = me?.username ? await profileLink(me.username) : null;
  const qr = link ? await qrSvg(link) : null;

  const Row = ({ id, name, sub }: { id: string; name: string; sub?: string }) => {
    const pp = person(id, name);
    const s = status.get(id);
    return (
      <li className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
        <Avatar p={pp} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold text-ink">{pp.name}</span>
          {sub && <span className="block text-[10.5px] text-muted">{sub}</span>}
        </span>
        {s === "Sent you a request" ? (
          <span className="flex items-center gap-2">
            <span className="text-[10.5px] text-muted">{s}</span>
            <form action={respondToFriend.bind(null, id, true)}><button className="min-h-[40px] rounded-full bg-coral px-4 text-[11.5px] font-bold text-white">Accept</button></form>
          </span>
        ) : s ? <span className="rounded-full bg-surface px-3 py-1.5 text-[11px] font-bold text-muted">{s}</span> : (
          <form action={async () => { "use server"; await sendFriendRequest(id); }}>
            <button className="min-h-[40px] rounded-full bg-coral px-4 text-[11.5px] font-bold text-white">Add</button>
          </form>
        )}
      </li>
    );
  };

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-10">
      <BackHeader href="/friends" title="Add friend" />
      <div className="px-6">
        <form role="search">
          <input name="q" defaultValue={q} placeholder="Name, email or @username" aria-label="Find someone by name, email or username"
            className="h-[50px] w-full rounded-full border-[1.5px] border-coral bg-card px-5 text-[14px] placeholder:text-muted focus:outline-none" />
        </form>
        {term.length >= 2 && (
          <ul className="mt-4 space-y-3">
            {[...found.values()].map((p) => <Row key={p.id} id={p.id} name={p.display_name} />)}
            {!found.size && <li className="text-[12.5px] text-muted">No one matches &ldquo;{term}&rdquo;. Email search needs the full address.</li>}
          </ul>
        )}

        {link && (
          <section className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-card p-4 shadow-card">
              <p className="text-[13px] font-bold text-ink">Share link</p>
              <p className="mt-0.5 truncate text-[10.5px] text-muted">{link.replace(/^https?:\/\//, "")}</p>
              <div className="mt-2"><CopyButton text={link} /></div>
            </div>
            <QrScanner />
            <details className="col-span-2 rounded-[18px] bg-card p-4 shadow-card">
              <summary className="cursor-pointer list-none">
                <span className="block text-[13px] font-bold text-ink">Show my QR code</span>
                <span className="block text-[10.5px] text-muted">Let a friend scan it to add you</span>
              </summary>
              {qr && <div className="mx-auto mt-3 max-w-[220px] [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR code for your add-friend link" dangerouslySetInnerHTML={{ __html: qr }} />}
            </details>
          </section>
        )}

        {(() => {
          const asking = [...status.entries()].filter(([, v]) => v === "Sent you a request").map(([k]) => k);
          return asking.length > 0 && !term ? <AskingRows ids={asking} /> : null;
        })()}
        {met.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[11px] font-bold text-ink">You travelled with them</h2>
            <p className="mb-2 text-[10.5px] text-muted">Not friends yet — add them to share future trips.</p>
            <ul className="space-y-3">{met.map((m) => <Row key={m.id} id={m.id} name={m.name} sub={`Met on ${m.trip}`} />)}</ul>
          </section>
        )}

        <div className="mt-6"><AtoNote label="Why add friends?">Friends can add their own photos to your trips, so one map holds everything.</AtoNote></div>
        <p className="mt-4 text-center text-[11px] text-muted">Nothing is shared until you invite them to a trip.</p>
      </div>
    </main>
  );
}

async function AskingRows({ ids }: { ids: string[] }) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[11px] font-bold text-ink">Waiting on you</h2>
      <ul className="space-y-3">
        {(data ?? []).map((p) => {
          const pp = person(p.id, p.display_name);
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
              <Avatar p={pp} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-bold text-ink">{pp.name}</span><span className="block text-[10.5px] text-muted">Sent you a request</span></span>
              <form action={respondToFriend.bind(null, p.id, true)}><button className="min-h-[40px] rounded-full bg-coral px-4 text-[11.5px] font-bold text-white">Accept</button></form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
