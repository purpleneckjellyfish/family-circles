import { redirect } from "next/navigation";

/** Older Alerts link. Notifications now live on Settings. */
export default function NotificationSettingsRedirect() {
  redirect("/settings#notifications");
}
