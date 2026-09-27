import { and, eq, inArray, isNull } from "drizzle-orm";
import webpush from "web-push";

import {
  familyMemberships,
  follows,
  getDb,
  notificationDigestItems,
  notificationPreferences,
  pushSubscriptions,
} from "@/db";
import { env, vapidConfigured } from "@/lib/env";

export type NotifyPostInput = {
  familyId: string;
  familyName: string;
  familySlug: string;
  postId: string;
  authorUserId: string;
  authorName: string;
  preview: string;
};

function configureWebPush() {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    env.vapidSubject,
    env.vapidPublicKey,
    env.vapidPrivateKey,
  );
  return true;
}

type Prefs = {
  pushEnabled: boolean;
  mode: "instant" | "digest" | "off";
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  digestHour: number;
};

const defaultPrefs: Prefs = {
  pushEnabled: true,
  mode: "instant",
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: "UTC",
  digestHour: 8,
};

/** True if local time in `timeZone` falls inside [start, end) allowing overnight windows. */
export function isInQuietHours(
  now: Date,
  timeZone: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start || !end) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const mins = hour * 60 + minute;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (
    [sh, sm, eh, em].some((n) => Number.isNaN(n)) ||
    sh! > 23 ||
    eh! > 23
  ) {
    return false;
  }
  const startMins = sh! * 60 + (sm ?? 0);
  const endMins = eh! * 60 + (em ?? 0);

  if (startMins === endMins) return false;
  if (startMins < endMins) {
    return mins >= startMins && mins < endMins;
  }
  // Overnight: e.g. 22:00 → 07:00
  return mins >= startMins || mins < endMins;
}

export function localHour(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

async function recipientUserIds(familyId: string, authorUserId: string) {
  const db = getDb();
  const members = await db
    .select({ userId: familyMemberships.userId })
    .from(familyMemberships)
    .where(eq(familyMemberships.familyId, familyId));
  const followers = await db
    .select({ userId: follows.followerUserId })
    .from(follows)
    .where(
      and(eq(follows.familyId, familyId), eq(follows.status, "accepted")),
    );

  return [
    ...new Set(
      [...members.map((m) => m.userId), ...followers.map((f) => f.userId)].filter(
        (id) => id !== authorUserId,
      ),
    ),
  ];
}

async function prefsForUsers(userIds: string[]): Promise<Map<string, Prefs>> {
  const map = new Map<string, Prefs>();
  for (const id of userIds) map.set(id, { ...defaultPrefs });
  if (userIds.length === 0) return map;

  const db = getDb();
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, userIds));

  for (const row of rows) {
    map.set(row.userId, {
      pushEnabled: row.pushEnabled,
      mode: row.mode,
      quietHoursStart: row.quietHoursStart,
      quietHoursEnd: row.quietHoursEnd,
      timezone: row.timezone || "UTC",
      digestHour: row.digestHour,
    });
  }
  return map;
}

async function sendToUserSubscriptions(
  userId: string,
  payload: { title: string; body: string; url: string },
) {
  if (!configureWebPush()) return { sent: 0, removed: 0 };

  const db = getDb();
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  let removed = 0;
  const json = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        json,
      );
      sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      // Gone / expired subscription
      if (status === 404 || status === 410) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
        removed += 1;
      }
    }
  }

  return { sent, removed };
}

/**
 * Notify circle members/followers about a new memory.
 * Respects push prefs: off / digest / quiet hours → queue; else immediate push.
 */
export async function notifyNewFamilyPost(input: NotifyPostInput) {
  if (!vapidConfigured()) return { skipped: "vapid_not_configured" as const };

  const recipients = await recipientUserIds(input.familyId, input.authorUserId);
  if (recipients.length === 0) return { recipients: 0, sent: 0, queued: 0 };

  const prefsMap = await prefsForUsers(recipients);
  const db = getDb();
  const now = new Date();
  const title = `${input.familyName}`;
  const body = `${input.authorName}: ${input.preview || "New memory"}`.slice(
    0,
    180,
  );
  const urlPath = `/families/${input.familySlug}/posts/${input.postId}`;

  let sent = 0;
  let queued = 0;

  for (const userId of recipients) {
    const prefs = prefsMap.get(userId) ?? defaultPrefs;
    if (!prefs.pushEnabled || prefs.mode === "off") continue;

    const quiet = isInQuietHours(
      now,
      prefs.timezone,
      prefs.quietHoursStart,
      prefs.quietHoursEnd,
    );
    const defer = prefs.mode === "digest" || quiet;

    if (defer) {
      await db.insert(notificationDigestItems).values({
        userId,
        familyId: input.familyId,
        postId: input.postId,
        title,
        body,
        urlPath,
      });
      queued += 1;
      continue;
    }

    const result = await sendToUserSubscriptions(userId, {
      title,
      body,
      url: urlPath,
    });
    sent += result.sent;
  }

  return { recipients: recipients.length, sent, queued };
}

/** Flush queued digest / quiet-hours items for users whose local digest hour matches. */
export async function flushNotificationDigests(now = new Date()) {
  if (!configureWebPush()) return { users: 0, sent: 0 };

  const db = getDb();
  const pending = await db
    .select()
    .from(notificationDigestItems)
    .where(isNull(notificationDigestItems.deliveredAt));

  if (pending.length === 0) return { users: 0, sent: 0 };

  const byUser = new Map<string, typeof pending>();
  for (const item of pending) {
    const list = byUser.get(item.userId) ?? [];
    list.push(item);
    byUser.set(item.userId, list);
  }

  const prefsMap = await prefsForUsers([...byUser.keys()]);
  let usersFlushed = 0;
  let sent = 0;

  for (const [userId, items] of byUser) {
    const prefs = prefsMap.get(userId) ?? defaultPrefs;
    if (!prefs.pushEnabled || prefs.mode === "off") continue;

    // Only flush at the user's digest hour, and not while still in quiet hours.
    const hour = localHour(now, prefs.timezone);
    if (hour !== prefs.digestHour) continue;
    if (
      isInQuietHours(
        now,
        prefs.timezone,
        prefs.quietHoursStart,
        prefs.quietHoursEnd,
      )
    ) {
      continue;
    }

    const count = items.length;
    const title =
      count === 1
        ? items[0]!.title
        : `Family Circles · ${count} new memories`;
    const body =
      count === 1
        ? items[0]!.body
        : items
            .slice(0, 3)
            .map((i) => i.body)
            .join(" · ")
            .slice(0, 180);
    const url = count === 1 ? items[0]!.urlPath : "/home";

    const result = await sendToUserSubscriptions(userId, { title, body, url });
    sent += result.sent;

    await db
      .update(notificationDigestItems)
      .set({ deliveredAt: now })
      .where(
        and(
          eq(notificationDigestItems.userId, userId),
          isNull(notificationDigestItems.deliveredAt),
        ),
      );
    usersFlushed += 1;
  }

  return { users: usersFlushed, sent };
}
