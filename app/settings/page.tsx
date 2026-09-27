import {
  NotificationPrefsForm,
  PushEnableButton,
} from "@/components/notification-settings";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";
import { getNotificationPrefs } from "@/lib/actions/notifications";
import { vapidConfigured } from "@/lib/env";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const prefs = await getNotificationPrefs(user.id!);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <h1 className="font-display text-4xl font-semibold text-ink">Settings</h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Your account and how Family Circles reaches you.
        </p>

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Account</h2>
          <div className="mt-4 rounded-xl border border-border/80 bg-card/60 px-4 py-4">
            <p className="text-ink">{user.name}</p>
            <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
            <form action={logoutAction} className="mt-4">
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </section>

        <section id="notifications" className="mt-12">
          <h2 className="font-display text-2xl text-ink">Notifications</h2>
          <p className="mt-2 max-w-lg text-sm text-ink-soft">
            Install Family Circles from the browser share menu, then turn on
            push for new memories. You can take alerts right away, as a daily
            digest, or stay quiet overnight.
          </p>
          <div className="mt-4">
            <PushEnableButton vapidReady={vapidConfigured()} />
          </div>
          <div className="mt-6">
            <NotificationPrefsForm prefs={prefs} />
          </div>
        </section>
      </main>
    </div>
  );
}
