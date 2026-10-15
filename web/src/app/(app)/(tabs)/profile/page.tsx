import Link from "next/link";
import { signOut } from "@/features/auth/actions";
import { requireProfile } from "@/features/auth/guards";
import { setMapTheme, setSetting } from "@/features/profile/settings";
import { InstallHint } from "@/components/pwa";
import { AvatarActions, ProfilePicture } from "@/features/profile/components/avatar-picker";
import { settingOn, type Settings } from "@/lib/types";
import { getMyTrips } from "@/features/trips/data";
import { avatarFor } from "@/lib/people";
import { lookFromUrl } from "@/lib/character";
import { Ato } from "@/components/ato";
import { learnForUser } from "@/features/planner/learn";
import { describeStyle } from "@/features/planner/style";

const THEMES = [
  { id: "water", name: "Water World", colors: ["#7FC9C2", "#0E4C55"] },
  { id: "forest", name: "Forest Trail", colors: ["#C9DFB8", "#4E7A46"] },
  { id: "night", name: "Night Sky", colors: ["#4A5480", "#1A1F38"] },
] as const;

/** 24 Profile & settings. */
export default async function ProfilePage() {
  const { supabase, user, profile } = await requireProfile();
  const [trips, { count: unread }, learned] = await Promise.all([
    getMyTrips(supabase, user.id),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient", user.id).is("read_at", null),
    learnForUser(supabase, user.id),
  ]);
  const style = describeStyle(learned);
  const stats = [
    [trips.length, "trips"],
    [trips.reduce((n, t) => n + t.memories, 0), "memories"],
    [trips.reduce((n, t) => n + t.places, 0), "places"],
  ] as const;
  const links = [
    ["Travel insights", "/insights"],
    [unread ? `Messages (${unread} new)` : "Messages", "/messages"],
    ["Friends", "/friends"],
    ["Saved trips", "/community?filter=saved"],
    ["Edit travel profile", "/onboarding"],
    ["Privacy & sharing", "/privacy"],
  ];
  return (
    <main className="wide:mx-auto wide:grid wide:max-w-5xl wide:grid-cols-2 wide:items-start wide:gap-8 wide:px-6 wide:pt-6">
      {/* wide: who you are on the left, settings on the right */}
      <div className="min-w-0">
      <section className="bg-gradient-to-b from-[#17707a] to-deeper px-6 pb-6 wide:rounded-[24px] pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-[17px] font-bold">Profile</h1>
          <form action={signOut}><button className="min-h-[40px] rounded-full bg-white/15 px-4 text-[12px] font-bold">Logout</button></form>
        </div>
        <div className="mt-5 flex items-center gap-4">
          <ProfilePicture src={avatarFor(user.id, profile.avatar_url)} size={68} />
          <div className="min-w-0">
            <p className="truncate text-[20px] font-bold">{profile.display_name}</p>
            <p className="truncate text-[11.5px] text-[#8fbdb8]">{user.email}</p>
          </div>
        </div>
        <div className="mt-4">
          <AvatarActions userId={user.id} next="/profile"
            showing={profile.avatar_url && !lookFromUrl(profile.avatar_url) ? "photo" : "character"}
            hasPhoto={Boolean(profile.settings?.photo_url || (profile.avatar_url && !lookFromUrl(profile.avatar_url)))} />
        </div>
        <dl className="mt-6 grid grid-cols-3 text-center">
          {stats.map(([n, l]) => (
            <div key={l}><dt className="sr-only">{l}</dt><dd className="text-[16px] font-bold">{n}</dd><dd className="text-[10px] text-[#8fbdb8]">{l}</dd></div>
          ))}
        </dl>
      </section>

      <div className="px-6 wide:px-0">
        <InstallHint />
        {settingOn(profile.settings, "ato_insights") && (
          <section aria-labelledby="style-title" className="mt-6 rounded-[18px] bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <Ato size={44} />
              <div className="min-w-0">
                <h2 id="style-title" className="text-[13px] font-bold text-ink">Your travel style</h2>
                <p className="mt-0.5 text-[12px] leading-snug text-body">
                  {style.line ?? "Finish a trip and rate a few places, and I'll learn how you like to travel."}
                </p>
              </div>
            </div>
            {style.tags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {style.tags.map((t) => <li key={t} className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-deep">{t}</li>)}
              </ul>
            )}
            {learned.evidence && learned.evidence.trips > 0 && (
              <p className="mt-3 text-[10.5px] text-muted">
                From {learned.evidence.trips} finished {learned.evidence.trips === 1 ? "trip" : "trips"} and {learned.evidence.places} places. I plan your next trip around it.
              </p>
            )}
          </section>
        )}
        <h2 className="mt-6 text-[11px] font-bold text-ink">Map theme</h2>
        <p className="text-[11px] text-muted">Changes how your memory map looks.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const on = (profile.settings?.map_theme ?? "water") === t.id;
            return (
              <form key={t.id} action={async () => { "use server"; await setMapTheme(t.id); }} className="text-center">
                <button aria-pressed={on} aria-label={`${t.name} map theme`} className="block w-full">
                  <span className={`block h-[74px] rounded-[14px] ${on ? "ring-[2.5px] ring-coral" : ""}`}
                    style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }} />
                  <span className={`mt-1.5 block text-[10.5px] ${on ? "font-bold text-ink" : "text-muted"}`}>{t.name}</span>
                </button>
              </form>
            );
          })}
        </div>
      </div>
      </div>

      <div className="min-w-0 px-6 wide:px-0">
        <h2 className="mt-7 text-[11px] font-bold text-ink wide:mt-0">Memory</h2>
        <ul className="mt-2 divide-y divide-line rounded-[16px] bg-card shadow-card">
          {([["auto_pin", "Auto-pin photos by location", "Off: every photo waits for you to place it"], ["friends_can_add", "Let friends add to my trips", "Off: people you invite can view and comment only"], ["ato_insights", "Ato insights", "Patterns and suggestions from your trips"]] as [keyof Settings, string, string][]).map(([key, label, hint]) => {
            const on = settingOn(profile.settings, key);
            return (
              <li key={key}>
                <form action={async () => { "use server"; await setSetting(key, !on); }}>
                  <button aria-pressed={on} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
                    <span><span className="block text-[13px] font-medium text-body">{label}</span><span className="block text-[10.5px] text-muted">{hint}</span></span>
                    <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-coral" : "bg-surface"}`}>
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${on ? "left-6" : "left-1"}`} />
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-7 text-[11px] font-bold text-ink">Account</h2>
        <ul className="mt-2 divide-y divide-line rounded-[16px] bg-card shadow-card">
          {links.map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="flex items-center justify-between px-4 py-3.5 text-[13px] font-medium text-body">
                {label}
                <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden><path d="M1 1 7 7 1 13" fill="none" stroke="#B9CFCC" strokeWidth={1.8} strokeLinecap="round" /></svg>
              </Link>
            </li>
          ))}
        </ul>
        {process.env.NEXT_PUBLIC_FEEDBACK_URL && (
          <a href={process.env.NEXT_PUBLIC_FEEDBACK_URL} target="_blank" rel="noreferrer"
            className="mt-6 flex min-h-[48px] items-center justify-center rounded-[15px] border border-coral text-[13.5px] font-bold text-coral">
            Tell us what you think ↗
          </a>
        )}
        <div className="pb-8" />
      </div>
    </main>
  );
}
