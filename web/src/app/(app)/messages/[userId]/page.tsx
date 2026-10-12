import { notFound } from "next/navigation";
import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { person } from "@/lib/people";
import { ThreadLive } from "./live";

export default async function ThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { supabase, user } = await requireUser();
  const { data: other } = await supabase.from("profiles").select("id, display_name").eq("id", userId).maybeSingle();
  if (!other || other.id === user.id) notFound();
  const { data: msgs } = await supabase.from("messages").select("*")
    .or(`and(sender.eq.${user.id},recipient.eq.${userId}),and(sender.eq.${userId},recipient.eq.${user.id})`)
    .order("created_at").limit(300);
  const p = person(other.id, other.display_name);
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] lg:max-w-2xl lg:pt-4 pb-28">
      <BackHeader href="/messages" title={p.name} />
      <ol className="space-y-2 px-5" aria-live="polite">
        {(msgs ?? []).map((m) => {
          const mine = m.sender === user.id;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[78%] rounded-[18px] px-4 py-2.5 text-[13px] leading-snug ${mine ? "rounded-br-[6px] bg-deep text-white" : "rounded-bl-[6px] bg-card text-ink shadow-card"}`}>
                {m.body}
                <span className={`mt-1 block text-[9.5px] ${mine ? "text-[#bfe4e0]" : "text-muted"}`}>
                  {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}{mine && m.read_at ? " · Read" : ""}
                </span>
              </p>
            </li>
          );
        })}
        {!msgs?.length && <li className="pt-10 text-center text-[12.5px] text-muted">Say hello to {p.name.split(" ")[0]}.</li>}
      </ol>
      <ThreadLive other={userId} />
    </main>
  );
}
