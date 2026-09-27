import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, media, posts } from "@/db";
import {
  ensureLocalFamilyActor,
  getLocalFamilyBySlug,
} from "@/lib/federation/actor";
import { buildNoteActivity } from "@/lib/federation/activities";
import { families } from "@/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ postId: string }> },
) {
  const { postId } = await ctx.params;
  const db = getDb();
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post || post.isRemote || post.hiddenAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.id, post.familyId))
    .limit(1);
  if (!family) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const local = await getLocalFamilyBySlug(family.slug);
  if (!local) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ready = await ensureLocalFamilyActor(local.id);
  const attachments = await db
    .select()
    .from(media)
    .where(eq(media.postId, post.id))
    .orderBy(media.sortOrder);

  const create = buildNoteActivity({
    family: ready,
    post,
    attachments: attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      mimeType: a.mimeType,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
    })),
  });

  return NextResponse.json(create.object, {
    headers: {
      "Content-Type": 'application/activity+json; charset=utf-8',
    },
  });
}
