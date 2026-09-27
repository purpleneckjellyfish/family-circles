import { NextResponse } from "next/server";

import {
  ensureLocalFamilyActor,
  buildFamilyActorJson,
  getLocalFamilyBySlug,
} from "@/lib/federation/actor";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const family = await getLocalFamilyBySlug(slug);
  if (!family) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ready = await ensureLocalFamilyActor(family.id);
  const body = buildFamilyActorJson(ready);
  return NextResponse.json(body, {
    headers: {
      "Content-Type": 'application/activity+json; charset=utf-8',
      "Cache-Control": "public, max-age=60",
    },
  });
}
