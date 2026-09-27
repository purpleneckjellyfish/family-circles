import exifr from "exifr";

/** YYYY-MM-DD from EXIF DateTimeOriginal / CreateDate when present. */
export async function memoryDateFromImageBytes(
  bytes: Buffer,
): Promise<string | null> {
  try {
    const data = await exifr.parse(bytes, {
      pick: ["DateTimeOriginal", "CreateDate", "DateTime"],
    });
    const raw =
      data?.DateTimeOriginal ?? data?.CreateDate ?? data?.DateTime ?? null;
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/** Client-side helper: earliest EXIF date among File objects. */
export async function earliestExifDateFromFiles(
  files: File[],
): Promise<string | null> {
  const dates: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    try {
      const data = await exifr.parse(file, {
        pick: ["DateTimeOriginal", "CreateDate", "DateTime"],
      });
      const raw =
        data?.DateTimeOriginal ?? data?.CreateDate ?? data?.DateTime ?? null;
      if (!raw) continue;
      const d = raw instanceof Date ? raw : new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        dates.push(d.toISOString().slice(0, 10));
      }
    } catch {
      /* skip unreadable EXIF */
    }
  }
  if (dates.length === 0) return null;
  return dates.sort()[0] ?? null;
}
