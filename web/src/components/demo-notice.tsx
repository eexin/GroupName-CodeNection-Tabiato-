/** Shown when someone in the shared demo account tries something destructive. */
export function DemoLocked() {
  return (
    <p role="status" className="mx-6 mb-4 rounded-[14px] border-l-4 border-sand bg-[#fff3e2] px-4 py-3 text-[12.5px] text-amber-ink">
      This is a shared sample account, so deleting and removing are switched off here. Everything else works, and it refreshes every night.
    </p>
  );
}
