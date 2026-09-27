"use client";

import { useActionState, useEffect, useState } from "react";

import { saveNotificationPrefsAction } from "@/lib/actions/notifications";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushEnableButton({ vapidReady }: { vapidReady: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => undefined);
  }, []);

  async function enable() {
    if (!vapidReady) {
      setStatus("Server is missing VAPID keys — see README.");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("This browser does not support web push.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("Notification permission was denied.");
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-public-key");
      const { publicKey, error } = await keyRes.json();
      if (!publicKey) {
        setStatus(error || "Could not load VAPID public key.");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(err.error || "Could not save subscription.");
        return;
      }
      setSubscribed(true);
      setStatus("Push enabled on this device.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Push setup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setStatus(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setStatus("Push disabled on this device.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not disable push.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={enable} disabled={busy}>
          {busy
            ? "…"
            : subscribed
              ? "Re-enable on this device"
              : "Enable push on this device"}
        </Button>
        {subscribed ? (
          <Button type="button" variant="outline" onClick={disable} disabled={busy}>
            Disable on this device
          </Button>
        ) : null}
      </div>
      {status ? <p className="text-sm text-ink-soft">{status}</p> : null}
      {!vapidReady ? (
        <p className="text-sm text-destructive">
          Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in `.env` (see README).
        </p>
      ) : null}
    </div>
  );
}

export function NotificationPrefsForm({
  prefs,
}: {
  prefs: {
    pushEnabled: boolean;
    mode: "instant" | "digest" | "off";
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    timezone: string;
    digestHour: number;
  };
}) {
  const [state, action, pending] = useActionState(
    saveNotificationPrefsAction,
    initial,
  );

  const browserTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : prefs.timezone;

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="pushEnabled"
          value="on"
          defaultChecked={prefs.pushEnabled}
          className="size-4"
        />
        Enable web push alerts
      </label>

      <div className="space-y-2">
        <Label htmlFor="mode">Delivery</Label>
        <select
          id="mode"
          name="mode"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          defaultValue={prefs.mode}
        >
          <option value="instant">Instant (when a memory is posted)</option>
          <option value="digest">Daily digest</option>
          <option value="off">Off (keep subscription, send nothing)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="quietHoursStart">Quiet hours start</Label>
          <Input
            id="quietHoursStart"
            name="quietHoursStart"
            type="time"
            defaultValue={prefs.quietHoursStart ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quietHoursEnd">Quiet hours end</Label>
          <Input
            id="quietHoursEnd"
            name="quietHoursEnd"
            type="time"
            defaultValue={prefs.quietHoursEnd ?? ""}
          />
        </div>
      </div>
      <p className="text-sm text-ink-soft">
        During quiet hours, alerts are queued and sent in your next digest window.
        Leave blank for no quiet hours.
      </p>

      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          name="timezone"
          defaultValue={prefs.timezone || browserTz}
          placeholder={browserTz}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="digestHour">Digest hour (local)</Label>
        <Input
          id="digestHour"
          name="digestHour"
          type="number"
          min={0}
          max={23}
          defaultValue={prefs.digestHour}
        />
        <p className="text-sm text-ink-soft">
          Cron should hit <code className="text-xs">/api/cron/digest</code> hourly;
          digests send when the local hour matches.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-forest">Preferences saved.</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
