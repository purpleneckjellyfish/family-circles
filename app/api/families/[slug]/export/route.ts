import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { loadExportMemories } from "@/lib/browse";
import { createFamilyExportZip } from "@/lib/export-zip";
import { requireFamilyView } from "@/lib/family-access";

export const runtime = "nodejs";

/** Stream a ZIP of originals + captions/dates for one circle. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const { user, family } = await requireFamilyView(slug);

  const memories = await loadExportMemories({
    userId: user.id!,
    familyId: family.id,
  });

  const photoCount = memories.reduce((n, m) => n + m.photos.length, 0);
  const exportedAt = new Date().toISOString();
  const zipStream = createFamilyExportZip({
    meta: {
      familyName: family.name,
      familySlug: family.slug,
      exportedAt,
      memoryCount: memories.length,
      photoCount,
    },
    memories,
  });

  const webStream = Readable.toWeb(zipStream) as unknown as ReadableStream;
  const safeSlug = family.slug.replace(/[^a-z0-9-_]/gi, "-");
  const filename = `${safeSlug}-export-${exportedAt.slice(0, 10)}.zip`;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
