import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

import {
  closeDb,
  families,
  familyMemberships,
  getDb,
  media,
  posts,
  users,
} from "../db";
import { hashPassword } from "../lib/password";
import { absoluteMediaPath, storeVideoFile } from "../lib/media-storage";
import { ffmpegAvailable, posterStoragePath } from "../lib/video";
import { access, readFile } from "node:fs/promises";

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)),
    );
  });
}

async function main() {
  if (!(await ffmpegAvailable())) {
    throw new Error("ffmpeg required for phase7 smoke");
  }

  const tmpDir = path.join(process.cwd(), "data", "tmp");
  await mkdir(tmpDir, { recursive: true });
  const rawPath = path.join(tmpDir, `phase7-src-${Date.now()}.mp4`);
  // Tiny synthetic clip (~1s color).
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=green:s=320x240:d=1",
    "-f",
    "lavfi",
    "-i",
    "sine=f=440:d=1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    rawPath,
  ]);

  const db = getDb();
  const email = `phase7-${Date.now()}@example.com`;
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: "Phase Seven",
      passwordHash: await hashPassword("password123"),
    })
    .returning();

  const slug = `phase7-${randomBytes(2).toString("hex")}`;
  const [family] = await db
    .insert(families)
    .values({ name: "Phase 7 Family", slug })
    .returning();
  await db.insert(familyMemberships).values({
    familyId: family.id,
    userId: user.id,
    role: "owner",
  });

  const [post] = await db
    .insert(posts)
    .values({
      familyId: family.id,
      authorUserId: user.id,
      body: "Phase 7 video memory",
      memoryDate: "2024-01-01",
    })
    .returning();

  const buf = await readFile(rawPath);
  const file = new File([buf], "clip.mp4", { type: "video/mp4" });
  const stored = await storeVideoFile({
    familyId: family.id,
    postId: post.id,
    file,
    index: 0,
  });

  await db.insert(media).values({
    postId: post.id,
    kind: "video",
    storagePath: stored.storagePath,
    mimeType: stored.mimeType,
    width: stored.width,
    height: stored.height,
    durationMs: stored.durationMs,
    sortOrder: 0,
  });

  await access(absoluteMediaPath(stored.storagePath));
  await access(absoluteMediaPath(posterStoragePath(stored.storagePath)));
  if (!stored.durationMs || stored.durationMs < 200) {
    throw new Error(`unexpected duration ${stored.durationMs}`);
  }

  await unlink(rawPath).catch(() => undefined);

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        email,
        postId: post.id,
        storagePath: stored.storagePath,
        durationMs: stored.durationMs,
        width: stored.width,
        height: stored.height,
      },
      null,
      2,
    ),
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
