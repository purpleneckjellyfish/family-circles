import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { federatedFollowers, getDb } from "@/db";
import {
  ensureLocalFamilyActor,
  getLocalFamilyBySlug,
} from "@/lib/federation/actor";
import { familyFollowersUrl } from "@/lib/federation/urls";

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
  const db = getDb();
  const rows = await db
    .select({ actorUri: federatedFollowers.actorUri })
    .from(federatedFollowers)
    .where(
      and(
        eq(federatedFollowers.familyId, ready.id),
        eq(federatedFollowers.status, "accepted"),
      ),
    )
    .limit(200);

  return NextResponse.json(
    {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: familyFollowersUrl(ready.slug),
      type: "OrderedCollection",
      totalItems: rows.length,
      orderedItems: rows.map((r) => r.actorUri),
    },
    {
      headers: {
        "Content-Type": 'application/activity+json; charset=utf-8',
      },
    },
  );
}
