import "dotenv/config";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

import {
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
import { hashPassword } from "../lib/password";
import { storeImageFile } from "../lib/media-storage";

async function main() {
  const db = getDb();
  const email = `phase2-${Date.now()}@example.com`;
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: "Phase Two",
      passwordHash: await hashPassword("password123"),
    })
    .returning();

  const slug = `phase2-${randomBytes(2).toString("hex")}`;
  const [family] = await db
    .insert(families)
    .values({ name: "Phase 2 Family", slug })
    .returning();
  await db.insert(familyMemberships).values({
    familyId: family.id,
    userId: user.id,
    role: "owner",
  });

  const [person] = await db
    .insert(people)
    .values({ familyId: family.id, displayName: "Kiddo" })
    .returning();

  const [post] = await db
    .insert(posts)
    .values({
      familyId: family.id,
      authorUserId: user.id,
      body: "Beach day text memory",
      memoryDate: "2020-07-04",
    })
    .returning();

  const png = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 40, g: 90, b: 60 },
    },
  })
    .png()
    .toBuffer();

  const file = new File([png], "beach.png", { type: "image/png" });
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
    width: 32,
    height: 24,
    sortOrder: 0,
  });
  await db.insert(postPeople).values({ postId: post.id, personId: person.id });

  const [check] = await db.select().from(posts).where(eq(posts.id, post.id));
  const mediaCount = await db.select().from(media).where(eq(media.postId, post.id));

  console.log(
    JSON.stringify({
      ok: Boolean(check && mediaCount.length === 1),
      slug,
      postId: post.id,
      mediaPath: stored.storagePath,
      email,
    }),
  );
}

main()
  .then(async () => closeDb())
  .catch(async (e) => {
    console.error(e);
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
