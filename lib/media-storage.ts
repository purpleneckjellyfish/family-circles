import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { env } from "@/lib/env";

function safeExt(mime: string, filename: string) {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/heic" || mime === "image/heif") return ".heic";
  return ".bin";
}

/** Absolute path for a storage key under DATA_DIR. */
export function absoluteMediaPath(storagePath: string) {
  const root = path.resolve(env.dataDir);
  const full = path.resolve(root, storagePath);
  // Prevent path escape outside DATA_DIR.
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error("Invalid media path");
  }
  return full;
}

export async function storeImageFile(opts: {
  familyId: string;
  postId: string;
  file: File;
  index: number;
}) {
  const mime = opts.file.type || "application/octet-stream";
  if (!mime.startsWith("image/")) {
    throw new Error("Only image uploads are supported in Phase 2");
  }

  const buf = Buffer.from(await opts.file.arrayBuffer());
  const ext = safeExt(mime, opts.file.name);
  const name = `${String(opts.index).padStart(2, "0")}-${randomBytes(6).toString("hex")}${ext}`;
  const storagePath = path.join(
    "families",
    opts.familyId,
    "posts",
    opts.postId,
    name,
  );
  const abs = absoluteMediaPath(storagePath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);

  return { storagePath: storagePath.replace(/\\/g, "/"), mimeType: mime, bytes: buf };
}
