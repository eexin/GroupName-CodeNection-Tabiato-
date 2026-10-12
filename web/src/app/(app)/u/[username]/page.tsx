import Link from "next/link";
import { notFound } from "next/navigation";
import { sendFriendRequest } from "@/features/friends/actions";
import { Ato } from "@/components/ato";
import { Avatar } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { person } from "@/lib/people";

/** tabiato.app/u/<username> — the add-me link from Figma 22b/22c. */
export default async function UserLinkPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { supabase, user } = await requireUser();
  const { data: found } = await supabase.rpc("find_profile", { q: `@${username}` });
  const p = (found as { id: string; display_name: string }[] | null)?.[0];
  if (!p) {
    const { data: self } = await supabase.from("profiles").select("username").eq("id", user.id).single();
    if (self?.username === username.toLowerCase()) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3 px-8 text-center">
          <Ato size={90} mood="happy" />
          <h1 className="text-[19px] font-bold text-ink">This is your link</h1>
          <p className="text-[13px] text-body">Send it to friends — opening it lets them add you.</p>
          <Link href="/friends/add" className="font-bold text-coral">Back to Add friend</Link>
        </main>
      );
    }
    notFound();
  }
  const { data: rel } = await supabase.from("friendships").select("*")
    .or(`and(requester.eq.${user.id},addressee.eq.${p.id}),and(requester.eq.${p.id},addressee.eq.${user.id})`);
  const r = rel?.[0];
  const pp = person(p.id, p.display_name);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-4 px-8 text-center">
      <Avatar p={pp} size={88} />
      <h1 className="text-[22px] font-bold text-ink">{pp.name}</h1>
      <p className="text-[12.5px] text-muted">@{username.toLowerCase()} on Tabiato</p>
      {r?.status === "accepted" ? (
        <p className="rounded-full bg-surface px-4 py-2 text-[12.5px] font-bold text-deep">You&apos;re friends</p>
      ) : r ? (
        <p className="rounded-full bg-surface px-4 py-2 text-[12.5px] font-bold text-muted">Request pending</p>
      ) : (
        <form action={async () => { "use server"; await sendFriendRequest(p.id); }} className="w-full max-w-[260px]">
          <button className="h-12 w-full rounded-[15px] bg-coral text-[14px] font-bold text-white">Add {pp.name.split(" ")[0]} as a friend</button>
        </form>
      )}
      <Link href="/friends" className="text-[13px] font-bold text-muted">Go to my friends</Link>
    </main>
  );
}
