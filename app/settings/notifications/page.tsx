import Link from "next/link";

import {
  NotificationPrefsForm,
  PushEnableButton,
} from "@/components/notification-settings";
import { SiteHeader } from "@/components/site-header";
import { getNotificationPrefs } from "@/lib/actions/notifications";
import { vapidConfigured } from "@/lib/env";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const prefs = await getNotificationPrefs(user.id!);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href="/home" className="hover:text-ink">
            ← Home
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          Notifications
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Install Family Circles on your phone home screen from the browser share
          menu, then enable web push for new memories in your circles.
        </p>

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">This device</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Requires HTTPS in production (or localhost). Push needs VAPID keys in
            the server environment.
          </p>
          <div className="mt-4">
            <PushEnableButton vapidReady={vapidConfigured()} />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">Preferences</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Choose instant alerts, a daily digest, and optional quiet hours.
          </p>
          <div className="mt-4">
            <NotificationPrefsForm prefs={prefs} />
          </div>
        </section>
      </main>
    </div>
  );
}
