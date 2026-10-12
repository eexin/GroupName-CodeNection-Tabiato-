/** The shared demo accounts judges and testers use. Destructive actions are switched off for them. */
export const DEMO_DOMAIN = "@demo.tabiato.app";
export const isDemoEmail = (email: string | null | undefined) => Boolean(email?.toLowerCase().endsWith(DEMO_DOMAIN));
export const demoEnabled = () => Boolean(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD);
