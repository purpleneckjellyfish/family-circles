import "dotenv/config";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import {
  albumPosts,
  albums,
  closeDb,
  families,
  familyMemberships,
  getDb,
  media,
  people,
  postPeople,
  posts,
  users,
} from "../db";
import {
  listAlbumsWithPostCounts,
  listPeopleWithPostCounts,
  listYearsWithPostCounts,
  loadExportMemories,
  loadPostsForPerson,
  loadPostsForYear,
} from "../lib/browse";
import { createFamilyExportZip } from "../lib/export-zip";
import { hashPassword } from "../lib/password";
import { storeImageFile } from "../lib/media-storage";

async function main() {
  const db = getDb();
  const email = `phase5-${Date.now()}@example.com`;
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: "Phase Five",
      passwordHash: await hashPassword("password123"),
    })
    .returning();

  const slug = `phase5-${randomBytes(2).toString("hex")}`;
  const [family] = await db
    .insert(families)
    .values({ name: "Phase 5 Family", slug })
    .returning();
  await db.insert(familyMemberships).values({
    familyId: family.id,
    userId: user.id,
    role: "owner",
  });

  const [person] = await db
    .insert(people)
    .values({ familyId: family.id, displayName: "Export Kid" })
    .returning();

  const [album] = await db
    .insert(albums)
    .values({
      familyId: family.id,
      title: "Summer album",
      description: "For browse by album",
    })
    .returning();

  const [post] = await db
    .insert(posts)
    .values({
      familyId: family.id,
      authorUserId: user.id,
      body: "Phase 5 caption for export",
      memoryDate: "2019-06-15",
    })
    .returning();

  await db.insert(postPeople).values({ postId: post.id, personId: person.id });
  await db.insert(albumPosts).values({ albumId: album.id, postId: post.id });

  const png = await sharp({
    create: {
      width: 48,
      height: 36,
      channels: 3,
      background: { r: 20, g: 80, b: 50 },
    },
  })
    .png()
    .toBuffer();

  const file = new File([png], "phase5.png", { type: "image/png" });
  const stored = await storeImageFile({
    familyId: family.id,
    postId: post.id,
    file,
    index: 0,
  });
  await db.insert(media).values({
    postId: post.id,
    kind: "image",
    storagePath: stored.storagePath,
    mimeType: stored.mimeType,
    width: stored.width,
    height: stored.height,
    sortOrder: 0,
  });

  const peopleRows = await listPeopleWithPostCounts(family.id);
  const yearRows = await listYearsWithPostCounts(family.id, user.id);
  const albumRows = await listAlbumsWithPostCounts(family.id);
  const byPerson = await loadPostsForPerson({
    userId: user.id,
    familyId: family.id,
    personId: person.id,
  });
  const byYear = await loadPostsForYear({
    userId: user.id,
    familyId: family.id,
    year: 2019,
  });
  const exportMemories = await loadExportMemories({
    userId: user.id,
    familyId: family.id,
  });

  if (!peopleRows.some((p) => p.id === person.id && p.postCount >= 1)) {
    throw new Error("browse by person count missing");
  }
  if (!yearRows.some((y) => y.year === 2019 && y.postCount >= 1)) {
    throw new Error("browse by year count missing");
  }
  if (!albumRows.some((a) => a.id === album.id && a.postCount >= 1)) {
    throw new Error("browse by album count missing");
  }
  if (byPerson.length !== 1 || byYear.length !== 1) {
    throw new Error("person/year post lists empty");
  }
  if (exportMemories.length !== 1 || exportMemories[0].photos.length !== 1) {
    throw new Error("export memories incomplete");
  }

  const zipStream = createFamilyExportZip({
    meta: {
      familyName: family.name,
      familySlug: family.slug,
      exportedAt: new Date().toISOString(),
      memoryCount: exportMemories.length,
      photoCount: 1,
    },
    memories: exportMemories,
  });

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    zipStream.on("data", (c: Buffer) => chunks.push(c));
    zipStream.on("end", () => resolve());
    zipStream.on("error", reject);
  });
  const zipBuf = Buffer.concat(chunks);
  if (zipBuf.length < 100 || zipBuf[0] !== 0x50 || zipBuf[1] !== 0x4b) {
    throw new Error("ZIP magic missing");
  }

  const outDir = path.join(process.cwd(), "data", "tmp");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}-export.zip`);
  await writeFile(outPath, zipBuf);

  const { execFileSync } = await import("node:child_process");
  const listing = execFileSync("unzip", ["-l", outPath], {
    encoding: "utf8",
  });
  for (const name of ["memories.json", "memories.csv", "README.txt", "photos/"]) {
    if (!listing.includes(name)) {
      throw new Error(`ZIP listing missing ${name}`);
    }
  }
  const jsonText = execFileSync("unzip", ["-p", outPath, "memories.json"], {
    encoding: "utf8",
  });
  if (!jsonText.includes("Phase 5 caption for export")) {
    throw new Error("memories.json missing caption");
  }
  const csvText = execFileSync("unzip", ["-p", outPath, "memories.csv"], {
    encoding: "utf8",
  });
  if (!csvText.includes("2019-06-15")) {
    throw new Error("memories.csv missing memory_date");
  }

  // Keep fixture family for manual UI checks; print ids.
  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        email,
        personId: person.id,
        year: 2019,
        albumId: album.id,
        zipBytes: zipBuf.length,
        zipPath: outPath,
        exportCaption: exportMemories[0].body,
      },
      null,
      2,
    ),
  );

  // Touch user so login scripts can find a known password if needed.
  await db
    .update(users)
    .set({ name: "Phase Five" })
    .where(eq(users.id, user.id));

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
