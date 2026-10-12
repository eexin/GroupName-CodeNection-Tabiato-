/** Skeleton for the tab screens — the shape of the page appears before its data. */
export default function TabsLoading() {
  return (
    <main className="px-6 pt-[max(1.5rem,env(safe-area-inset-top))]" role="status" aria-live="polite" aria-label="Loading">
      <div className="h-8 w-32 animate-pulse rounded-[10px] bg-surface" />
      <div className="mt-6 h-10 animate-pulse rounded-[14px] bg-surface" />
      <ul className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => <li key={i} className="h-[124px] animate-pulse rounded-[20px] bg-card shadow-card" />)}
      </ul>
    </main>
  );
}
