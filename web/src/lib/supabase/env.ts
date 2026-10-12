/** Supabase is optional until lane A wires it up — the UI runs on demo data without it. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
