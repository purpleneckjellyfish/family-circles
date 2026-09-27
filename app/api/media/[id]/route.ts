import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { follows, getDb, media, posts } from "@/db";
import { absoluteMediaPath } from "@/lib/media-storage";
import { getMembership } from "@/lib/permissions";
import { posterStoragePath } from "@/lib/video";

function parseRange(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

/** Short-lived proxy for remote federated media (no local mirror required). */
async function proxyRemote(remoteUri: string, req: Request, mimeType: string | null) {
  const range = req.headers.get("range");
  const upstream = await fetch(remoteUri, {
    headers: range ? { Range: range } : undefined,
    redirect: "follow",
  });
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Origin media unavailable" }, { status: 502 });
  }
  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || mimeType || "application/octet-stream",
  );
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("Content-Range", cr);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=300");
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const variant = new URL(req.url).searchParams.get("variant");
  const db = getDb();
  const [row] = await db
    .select({
      id: media.id,
      storagePath: media.storagePath,
      remoteUri: media.remoteUri,
      mimeType: media.mimeType,
      kind: media.kind,
      postId: media.postId,
      familyId: posts.familyId,
      hiddenAt: posts.hiddenAt,
    })
    .from(media)
    .innerJoin(posts, eq(posts.id, media.postId))
    .where(eq(media.id, id))
    .limit(1);

  if (!row || (!row.storagePath && !row.remoteUri)) {
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

  // Federated attachment — stream from origin (or redirect if HEAD-unfriendly).
  if (!row.storagePath && row.remoteUri) {
    return proxyRemote(row.remoteUri, req, row.mimeType);
  }

  const wantPoster = variant === "poster" && row.kind === "video";
  const relPath = wantPoster
    ? posterStoragePath(row.storagePath!)
    : row.storagePath!;
  const contentType = wantPoster
    ? "image/jpeg"
    : row.mimeType || "application/octet-stream";

  try {
    const abs = absoluteMediaPath(relPath);
    const info = await stat(abs);
    const rangeHeader = req.headers.get("range");

    if (rangeHeader && !wantPoster) {
      const range = parseRange(rangeHeader, info.size);
      if (!range) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${info.size}` },
        });
      }
      const { start, end } = range;
      const chunkSize = end - start + 1;
      const stream = createReadStream(abs, { start, end });
      const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const stream = createReadStream(abs);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  }
}
