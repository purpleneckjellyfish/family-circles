import "dotenv/config";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import {
  closeDb,
  families,
  familyMemberships,
  getDb,
  milestones,
  people,
  posts,
  users,
} from "../db";
import { hashPassword } from "../lib/password";
import { loadThrowbacks } from "../lib/throwbacks";

async function main() {
  const db = getDb();
  const stamp = Date.now();
  const email = `phase3-${stamp}@example.com`;
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: "Phase Three",
      passwordHash: await hashPassword("password123"),
    })
    .returning();

  const slug = `phase3-${randomBytes(2).toString("hex")}`;
  const [family] = await db
    .insert(families)
    .values({ name: "Phase 3 Family", slug })
    .returning();
  await db.insert(familyMemberships).values({
    familyId: family.id,
    userId: user.id,
    role: "owner",
  });

  // Fixed "today" for deterministic assertions.
  const onDate = "2026-09-27";
  const priorMemory = "2020-09-27";
  const priorPosted = new Date("2019-09-27T15:00:00.000Z");

  await db.insert(posts).values({
    familyId: family.id,
    authorUserId: user.id,
    body: "Memory-date throwback",
    memoryDate: priorMemory,
    postedAt: new Date("2020-10-01T12:00:00.000Z"),
  });

  await db.insert(posts).values({
    familyId: family.id,
    authorUserId: user.id,
    body: "Posted-at fallback throwback",
    memoryDate: null,
    postedAt: priorPosted,
  });

  // Same calendar day this year should NOT appear (not prior year).
  await db.insert(posts).values({
    familyId: family.id,
    authorUserId: user.id,
    body: "This year — skip",
    memoryDate: onDate,
  });

  const [person] = await db
    .insert(people)
    .values({
      familyId: family.id,
      displayName: "Ada",
      birthday: "2015-09-27",
    })
    .returning();

  await db.insert(milestones).values({
    familyId: family.id,
    title: "Wedding day",
    kind: "anniversary",
    occursOn: "2012-09-27",
    personId: person.id,
  });

  const result = await loadThrowbacks({
    userId: user.id,
    familyId: family.id,
    onDate,
  });

  const bodies = result.memories.map((m) => m.post.body).sort();
  const milestoneTitles = result.milestones.map((m) => m.title).sort();

  console.log(
    JSON.stringify(
      {
        ok:
          bodies.includes("Memory-date throwback") &&
          bodies.includes("Posted-at fallback throwback") &&
          !bodies.includes("This year — skip") &&
          milestoneTitles.includes("Ada's birthday") &&
          milestoneTitles.includes("Wedding day"),
        memoryCount: result.memories.length,
        bodies,
        milestoneTitles,
        yearsAgo: result.memories.map((m) => m.yearsAgo).sort(),
        slug,
      },
      null,
      2,
    ),
  );

  // cleanup soft — leave data for manual UI if useful; delete user cascade not set on all
  await db.delete(users).where(eq(users.id, user.id));
}

main()
  .then(async () => closeDb())
  .catch(async (e) => {
    console.error(e);
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
