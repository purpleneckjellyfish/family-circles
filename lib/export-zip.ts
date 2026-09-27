import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { PassThrough } from "node:stream";

import { ZipArchive } from "archiver";

import type { ExportMemory } from "@/lib/browse";
import { absoluteMediaPath } from "@/lib/media-storage";

export type FamilyExportMeta = {
  familyName: string;
  familySlug: string;
  exportedAt: string;
  memoryCount: number;
  photoCount: number;
};

/**
 * Build a ZIP stream: media under photos/ (images + playable videos), plus
 * memories.json and memories.csv with captions and dates.
 */
export function createFamilyExportZip(opts: {
  meta: FamilyExportMeta;
  memories: ExportMemory[];
}) {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const pass = new PassThrough();
  archive.pipe(pass);

  const jsonPayload = {
    ...opts.meta,
    memories: opts.memories.map((m) => ({
      id: m.id,
      caption: m.body,
      memoryDate: m.memoryDate,
      postedAt: m.postedAt,
      authorName: m.authorName,
      people: m.people,
      albums: m.albums,
      photos: m.photos.map((p) => ({
        file: `photos/${p.fileName}`,
        mimeType: p.mimeType,
        width: p.width,
        height: p.height,
      })),
    })),
  };

  archive.append(JSON.stringify(jsonPayload, null, 2), {
    name: "memories.json",
  });

  const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csvLines = [
    [
      "post_id",
      "caption",
      "memory_date",
      "posted_at",
      "author",
      "people",
      "albums",
      "photo_file",
    ].join(","),
  ];

  for (const m of opts.memories) {
    if (m.photos.length === 0) {
      csvLines.push(
        [
          csvEscape(m.id),
          csvEscape(m.body ?? ""),
          csvEscape(m.memoryDate ?? ""),
          csvEscape(m.postedAt),
          csvEscape(m.authorName ?? ""),
          csvEscape(m.people.join("; ")),
          csvEscape(m.albums.join("; ")),
          "",
        ].join(","),
      );
      continue;
    }
    for (const photo of m.photos) {
      csvLines.push(
        [
          csvEscape(m.id),
          csvEscape(m.body ?? ""),
          csvEscape(m.memoryDate ?? ""),
          csvEscape(m.postedAt),
          csvEscape(m.authorName ?? ""),
          csvEscape(m.people.join("; ")),
          csvEscape(m.albums.join("; ")),
          csvEscape(`photos/${photo.fileName}`),
        ].join(","),
      );
    }
  }

  archive.append(csvLines.join("\n") + "\n", { name: "memories.csv" });

  archive.append(
    [
      "Family Circles export",
      `Circle: ${opts.meta.familyName} (${opts.meta.familySlug})`,
      `Exported: ${opts.meta.exportedAt}`,
      "",
      "photos/        original images and playable MP4 videos",
      "memories.json  captions, dates, tags, album names",
      "memories.csv   flat table of the same metadata",
      "",
    ].join("\n"),
    { name: "README.txt" },
  );

  // Append files asynchronously so the response can stream immediately.
  void (async () => {
    for (const m of opts.memories) {
      for (const photo of m.photos) {
        try {
          const abs = absoluteMediaPath(photo.storagePath);
          await access(abs);
          archive.append(createReadStream(abs), {
            name: `photos/${photo.fileName}`,
          });
        } catch {
          // Skip missing originals; metadata still records the intended path.
        }
      }
    }
    await archive.finalize();
  })();

  archive.on("error", (err) => {
    pass.destroy(err);
  });

  return pass;
}
