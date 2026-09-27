import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { follows, getDb, media, posts } from "@/db";
import { absoluteMediaPath } from "@/lib/media-storage";
import { getMembership } from "@/lib/permissions";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const db = getDb();
  const [row] = await db
    .select({
      id: media.id,
      storagePath: media.storagePath,
      mimeType: media.mimeType,
      postId: media.postId,
      familyId: posts.familyId,
      hiddenAt: posts.hiddenAt,
    })
    .from(media)
    .innerJoin(posts, eq(posts.id, media.postId))
    .where(eq(media.id, id))
    .limit(1);

  if (!row?.storagePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = await getMembership(session.user.id, row.familyId);
  const [follow] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(
        eq(follows.followerUserId, session.user.id),
        eq(follows.familyId, row.familyId),
        eq(follows.status, "accepted"),
      ),
    )
    .limit(1);

  if (!membership && !follow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    row.hiddenAt &&
    membership?.role !== "owner" &&
    membership?.role !== "adult"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const abs = absoluteMediaPath(row.storagePath);
    const info = await stat(abs);
    const stream = createReadStream(abs);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  }
}
