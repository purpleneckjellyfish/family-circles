import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { flushNotificationDigests } from "@/lib/push";

/**
 * Flush digest / post-quiet-hours queues.
 * Call hourly from Unraid cron / systemd with header: Authorization: Bearer $CRON_SECRET
 */
export async function POST(req: Request) {
  if (!env.cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (token !== env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await flushNotificationDigests();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return POST(req);
}
