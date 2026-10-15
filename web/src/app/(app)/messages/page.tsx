import Link from "next/link";
import { Avatar, BackHeader, Empty } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { person } from "@/lib/people";

/** Your conversations, newest first, with unread counts. */
export default async function InboxPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("messages").select("*").or(`sender.eq.${user.id},recipient.eq.${user.id}`).order("created_at", { ascending: false }).limit(200);
  const threads = new Map<string, { last: string; at: string; unread: number }>();
  for (const m of data ?? []) {
    const other = m.sender === user.id ? m.recipient : m.sender;
    const t = threads.get(other) ?? { last: m.body, at: m.created_at, unread: 0 };
    if (m.recipient === user.id && !m.read_at) t.unread++;
    threads.set(other, t);
  }
  const { data: people } = threads.size ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", [...threads.keys()]) : { data: [] as { id: string; display_name: string; avatar_url: string | null }[] };
  const who = new Map((people ?? []).map((p) => [p.id, person(p.id, p.display_name, p.avatar_url)]));
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 wide:max-w-3xl wide:pt-4">
      <BackHeader href="/profile" title="Messages" />
      {threads.size === 0 ? <Empty title="No messages yet">Message a friend, or the author of a trip you like in Community.</Empty> : (
        <ul className="space-y-2.5 px-6">
          {[...threads.entries()].map(([id, t]) => {
            const p = who.get(id) ?? person(id, null);
            return (
              <li key={id}>
                <Link href={`/messages/${id}`} className="flex items-center gap-3 rounded-[16px] bg-card p-3.5 shadow-card">
                  <Avatar p={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold text-ink">{p.name}</span>
                    <span className={`block truncate text-[11.5px] ${t.unread ? "font-bold text-ink" : "text-muted"}`}>{t.last}</span>
                  </span>
                  {t.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-coral px-1.5 text-[11px] font-bold text-white" aria-label={`${t.unread} unread`}>{t.unread}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
