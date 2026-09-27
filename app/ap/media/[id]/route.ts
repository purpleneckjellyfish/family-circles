import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, media, posts } from "@/db";
import { absoluteMediaPath } from "@/lib/media-storage";

export const runtime = "nodejs";

/**
 * Public federation media endpoint (UUID obscurity).
 * Remote instances fetch originals from origin — never mirrored mandatorily.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = getDb();
  const [row] = await db
    .select({
      storagePath: media.storagePath,
      remoteUri: media.remoteUri,
      mimeType: media.mimeType,
      hiddenAt: posts.hiddenAt,
      isRemote: posts.isRemote,
    })
    .from(media)
    .innerJoin(posts, eq(posts.id, media.postId))
    .where(eq(media.id, id))
    .limit(1);

  if (!row || row.hiddenAt || row.isRemote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!row.storagePath) {
    if (row.remoteUri) {
      return NextResponse.redirect(row.remoteUri);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const abs = absoluteMediaPath(row.storagePath);
    const info = await stat(abs);
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Number(m[2]) : info.size - 1;
        const stream = createReadStream(abs, { start, end });
        return new NextResponse(
          Readable.toWeb(stream) as unknown as ReadableStream,
          {
            status: 206,
            headers: {
              "Content-Type": row.mimeType || "application/octet-stream",
              "Content-Length": String(end - start + 1),
              "Content-Range": `bytes ${start}-${end}/${info.size}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      }
    }

    const stream = createReadStream(abs);
    return new NextResponse(
      Readable.toWeb(stream) as unknown as ReadableStream,
      {
        headers: {
          "Content-Type": row.mimeType || "application/octet-stream",
          "Content-Length": String(info.size),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  }
}
