/** Currencies the ECB publishes daily reference rates for (via Frankfurter), so they convert to MYR. */
export const CURRENCIES = ["MYR", "JPY", "KRW", "IDR", "THB", "SGD", "PHP", "CNY", "HKD", "INR", "AUD", "NZD", "USD", "EUR", "GBP", "CHF", "CAD", "TRY"] as const;
export type Currency = (typeof CURRENCIES)[number];

const BY_COUNTRY: Record<string, Currency> = {
  MY: "MYR", JP: "JPY", KR: "KRW", ID: "IDR", TH: "THB", SG: "SGD", PH: "PHP", CN: "CNY", HK: "HKD", IN: "INR",
  AU: "AUD", NZ: "NZD", US: "USD", GB: "GBP", CH: "CHF", CA: "CAD", TR: "TRY",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", PT: "EUR", AT: "EUR", BE: "EUR", IE: "EUR", FI: "EUR", GR: "EUR",
};
export const currencyForCountry = (cc: string | null | undefined): Currency => BY_COUNTRY[(cc ?? "").toUpperCase()] ?? "MYR";

/** An expense in MYR: the stored conversion, the amount itself if it was MYR, else unknown (0). */
export const myr = (e: { amount: number | string; currency?: string | null; amount_myr?: number | string | null }) =>
  e.amount_myr != null ? Number(e.amount_myr) : (e.currency ?? "MYR") === "MYR" ? Number(e.amount) : 0;

/** "RM 957.80", "RM 60", "JPY 30,000" — sen shown as two digits whenever there are any. */
export const money = (amount: number, currency = "MYR") => {
  const whole = currency === "JPY" || currency === "KRW" || currency === "IDR";
  const cents = !whole && Math.round(amount * 100) % 100 !== 0;
  return `${currency === "MYR" ? "RM" : currency} ${amount.toLocaleString("en", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: whole ? 0 : 2 })}`;
};
