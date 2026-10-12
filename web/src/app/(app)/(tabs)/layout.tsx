import { BottomNav } from "@/components/bottom-nav";
import { requireProfile } from "@/features/auth/guards";

/** Shell for the four main tabs. Signed-in, onboarded users only. */
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] bg-paper pb-[calc(76px+env(safe-area-inset-bottom))] lg:max-w-none lg:pb-0">
      {children}
      <BottomNav />
    </div>
  );
}
