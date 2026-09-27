import { NextResponse } from "next/server";

import { env, vapidConfigured } from "@/lib/env";

export async function GET() {
  if (!vapidConfigured()) {
    return NextResponse.json(
      { error: "VAPID keys not configured", publicKey: null },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey: env.vapidPublicKey });
}
