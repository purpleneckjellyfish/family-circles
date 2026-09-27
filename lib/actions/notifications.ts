"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb, notificationPreferences } from "@/db";
import type { ActionState } from "@/lib/actions/auth";
import { requireUser } from "@/lib/session";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const prefsSchema = z.object({
  pushEnabled: z.enum(["on", "off"]),
  mode: z.enum(["instant", "digest", "off"]),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  timezone: z.string().trim().min(1).max(64),
  digestHour: z.coerce.number().int().min(0).max(23),
});

export async function saveNotificationPrefsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const quietStart = String(formData.get("quietHoursStart") ?? "").trim();
  const quietEnd = String(formData.get("quietHoursEnd") ?? "").trim();

  const parsed = prefsSchema.safeParse({
    pushEnabled: formData.get("pushEnabled") === "on" ? "on" : "off",
    mode: formData.get("mode"),
    quietHoursStart: quietStart || undefined,
    quietHoursEnd: quietEnd || undefined,
    timezone: formData.get("timezone") || "UTC",
    digestHour: formData.get("digestHour"),
  });

  if (!parsed.success) {
    return { error: "Check your notification settings." };
  }

  if (
    (quietStart && !timeRe.test(quietStart)) ||
    (quietEnd && !timeRe.test(quietEnd))
  ) {
    return { error: "Quiet hours must look like HH:MM (24-hour)." };
  }
  if ((quietStart && !quietEnd) || (!quietStart && quietEnd)) {
    return { error: "Set both quiet-hours start and end, or leave both blank." };
  }

  const db = getDb();
  await db
    .insert(notificationPreferences)
    .values({
      userId: user.id!,
      pushEnabled: parsed.data.pushEnabled === "on",
      mode: parsed.data.mode,
      quietHoursStart: quietStart || null,
      quietHoursEnd: quietEnd || null,
      timezone: parsed.data.timezone,
      digestHour: parsed.data.digestHour,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        pushEnabled: parsed.data.pushEnabled === "on",
        mode: parsed.data.mode,
        quietHoursStart: quietStart || null,
        quietHoursEnd: quietEnd || null,
        timezone: parsed.data.timezone,
        digestHour: parsed.data.digestHour,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/settings");
  return { success: "saved" };
}

export async function getNotificationPrefs(userId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  return (
    row ?? {
      userId,
      pushEnabled: true,
      mode: "instant" as const,
      quietHoursStart: null as string | null,
      quietHoursEnd: null as string | null,
      timezone: "UTC",
      digestHour: 8,
    }
  );
}
