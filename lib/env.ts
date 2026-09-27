/**
 * Central place for required runtime env vars.
 * Auth / push / federation arrive in later phases; placeholders stay documented.
 */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
  appUrl: process.env.APP_URL ?? "http://127.0.0.1:43127",
  dataDir: process.env.DATA_DIR ?? "./data",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
  /** Shared secret for /api/cron/digest (Unraid / cron jobs). */
  cronSecret: process.env.CRON_SECRET ?? "",
};

export function vapidConfigured() {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey);
}
