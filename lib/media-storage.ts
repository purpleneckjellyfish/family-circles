import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { env } from "@/lib/env";
import {
  extractPoster,
  ffmpegAvailable,
  posterStoragePath,
  probeVideo,
  sourceStoragePath,
  transcodeToMp4,
} from "@/lib/video";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function safeExt(mime: string, filename: string) {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/heic" || mime === "image/heif") return ".heic";
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/quicktime") return ".mov";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/x-msvideo") return ".avi";
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
    throw new Error("Only image uploads are supported here");
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

  return {
    storagePath: storagePath.replace(/\\/g, "/"),
    mimeType: mime,
    bytes: buf,
  };
}

const ALLOWED_VIDEO = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
]);

/**
 * Store a video upload, transcode to browser-friendly H.264 MP4, and extract a poster.
 * Keeps the original beside the playable file (`*-source.*`).
 */
export async function storeVideoFile(opts: {
  familyId: string;
  postId: string;
  file: File;
  index: number;
}) {
  const mime = opts.file.type || "application/octet-stream";
  if (!ALLOWED_VIDEO.has(mime) && !mime.startsWith("video/")) {
    throw new Error("Unsupported video type. Use MP4, MOV, or WebM.");
  }
  if (opts.file.size > MAX_VIDEO_BYTES) {
    throw new Error("Each video must be 200 MB or smaller.");
  }
  if (!(await ffmpegAvailable())) {
    throw new Error(
      "ffmpeg is not installed. On a Mac, run `brew install ffmpeg`. The Docker image already includes it (see docs/unraid.md).",
    );
  }

  const buf = Buffer.from(await opts.file.arrayBuffer());
  const sourceExt = safeExt(mime, opts.file.name);
  const stem = `${String(opts.index).padStart(2, "0")}-${randomBytes(6).toString("hex")}`;
  const dirRel = path.join(
    "families",
    opts.familyId,
    "posts",
    opts.postId,
  );
  const playableRel = path.join(dirRel, `${stem}.mp4`).replace(/\\/g, "/");
  const sourceRel = sourceStoragePath(playableRel, sourceExt);
  const posterRel = posterStoragePath(playableRel);

  const sourceAbs = absoluteMediaPath(sourceRel);
  const playableAbs = absoluteMediaPath(playableRel);
  const posterAbs = absoluteMediaPath(posterRel);
  await mkdir(path.dirname(sourceAbs), { recursive: true });
  await writeFile(sourceAbs, buf);

  try {
    await transcodeToMp4({ inputAbs: sourceAbs, outputAbs: playableAbs });
    await extractPoster({ inputAbs: playableAbs, outputAbs: posterAbs });
  } catch (err) {
    await unlink(sourceAbs).catch(() => undefined);
    await unlink(playableAbs).catch(() => undefined);
    await unlink(posterAbs).catch(() => undefined);
    throw err instanceof Error
      ? err
      : new Error("Could not transcode video.");
  }

  const probe = await probeVideo(playableAbs);
  return {
    storagePath: playableRel,
    posterStoragePath: posterRel,
    sourceStoragePath: sourceRel,
    mimeType: "video/mp4",
    width: probe.width,
    height: probe.height,
    durationMs: probe.durationMs,
  };
}

/** Best-effort delete of playable + poster + source siblings. */
export async function removeMediaFiles(storagePath: string | null | undefined) {
  if (!storagePath) return;
  const targets = [
    storagePath,
    posterStoragePath(storagePath),
    // Common source extensions we may have written.
    ...[".mp4", ".mov", ".webm", ".avi", ".bin"].map((ext) =>
      sourceStoragePath(storagePath, ext),
    ),
  ];
  for (const rel of targets) {
    try {
      await unlink(absoluteMediaPath(rel));
    } catch {
      /* missing is fine */
    }
  }
}
