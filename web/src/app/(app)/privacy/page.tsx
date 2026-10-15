import Link from "next/link";
import { BackHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/guards";
import { TWO_COLUMNS } from "@/lib/layout";

const ROWS = [
  ["Notes and receipts", "Always private. Only the people on a trip can see them — never the public, whatever a trip's sharing settings say."],
  ["Spending on public trips", "If you switch it on, others see category totals only (for example Food 38%) — never individual expenses or what you wrote on them."],
  ["Who sees a trip", "Only the people on it, unless you choose otherwise in Trip options → Who can see it: your friends (on your profile, not in Community) or everyone (also in Community). You also choose whether photos, ratings, comments and spending totals are shown."],
  ["Who can add photos", "Set in Profile → Memory. Anyone you invite can be switched to view-only from the trip's members list."],
  ["Photo locations", "Read on your phone before upload. If a photo has none, we ask you where it was — we never guess."],
  ["AI", "Ato writes from the numbers we calculate from your trip. Your data isn't used to train anyone's model."],
];

/** Privacy & sharing (Figma 24 row). Plain statements of what the app actually enforces. */
export default async function PrivacyPage() {
  await requireUser();
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] pb-10 wide:max-w-5xl wide:pt-4">
      <BackHeader href="/profile" title="Privacy & sharing" />
      <ul className={`space-y-3 px-6 ${TWO_COLUMNS}`}>
        {ROWS.map(([t, d]) => (
          <li key={t} className="rounded-[16px] bg-card p-4 shadow-card">
            <p className="text-[13px] font-bold text-ink">{t}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-body">{d}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 px-6 text-[11.5px] text-muted">
        Change who sees what: <Link href="/profile" className="font-bold text-coral">Memory settings</Link> · trip sharing lives in each trip&apos;s options.
      </p>
    </main>
  );
}
