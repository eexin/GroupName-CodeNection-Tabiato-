import Link from "next/link";
import { redirect } from "next/navigation";
import { Ato } from "@/components/ato";
import { requireUser } from "@/features/auth/guards";

/** Opening a trip invite link joins you to the trip (Figma 20 "Share invite link"). */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { supabase } = await requireUser();
  const { data: tripId } = await supabase.rpc("join_trip", { code });
  if (tripId) redirect(`/trips/${tripId}`);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3 px-8 text-center">
      <Ato size={96} mood="rest" />
      <h1 className="text-[20px] font-bold text-ink">This invite link doesn&apos;t work</h1>
      <p className="text-[13px] text-body">It may have been typed wrong, or the trip was deleted. Ask for a new link.</p>
      <Link href="/" className="mt-2 font-bold text-coral">Go to my map</Link>
    </main>
  );
}
