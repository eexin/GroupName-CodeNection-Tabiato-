import "server-only";

/** Convert to MYR with Frankfurter (ECB reference rates, free, no key). Null if it can't. */
export async function toMYR(amount: number, currency: string, date?: string): Promise<number | null> {
  if (currency === "MYR") return Math.round(amount * 100) / 100;
  const when = date && date <= new Date().toISOString().slice(0, 10) ? date : "latest";
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/${when}?base=${currency}&symbols=MYR`, { next: { revalidate: 43200 } });
    if (!res.ok) return null;
    const rate = (await res.json())?.rates?.MYR;
    return typeof rate === "number" ? Math.round(amount * rate * 100) / 100 : null;
  } catch {
    return null;
  }
}
