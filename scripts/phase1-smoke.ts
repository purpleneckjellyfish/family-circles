import "dotenv/config";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { families, familyMemberships, follows, getDb, invites, users } from "../db";
import { hashPassword, verifyPassword } from "../lib/password";
import { slugify } from "../lib/slug";

async function main() {
  const db = getDb();
  const email = `owner-${Date.now()}@example.com`;
  const password = "password123";
  const passwordHash = await hashPassword(password);
  const [owner] = await db
    .insert(users)
    .values({ email, name: "Owner One", passwordHash })
    .returning();

  const ok = await verifyPassword(password, owner.passwordHash!);
  const slug = `${slugify("Test Circle")}-${randomBytes(2).toString("hex")}`;
  const [family] = await db
    .insert(families)
    .values({ name: "Test Circle", slug, summary: "Phase 1 check" })
    .returning();
  await db.insert(familyMemberships).values({
    familyId: family.id,
    userId: owner.id,
    role: "owner",
  });

  const token = randomBytes(12).toString("base64url");
  await db.insert(invites).values({
    familyId: family.id,
    token,
    role: "adult",
    createdByUserId: owner.id,
    expiresAt: new Date(Date.now() + 86400000),
  });

  const collabEmail = `collab-${Date.now()}@example.com`;
  const [collab] = await db
    .insert(users)
    .values({
      email: collabEmail,
      name: "Collab Two",
      passwordHash: await hashPassword(password),
    })
    .returning();
  await db.insert(familyMemberships).values({
    familyId: family.id,
    userId: collab.id,
    role: "follower",
  });
  await db.insert(follows).values({
    followerUserId: collab.id,
    familyId: family.id,
    status: "accepted",
  });

  const members = await db
    .select()
    .from(familyMemberships)
    .where(eq(familyMemberships.familyId, family.id));

  console.log(
    JSON.stringify(
      {
        ok,
        roles: members.map((m) => m.role).sort(),
        slug,
        token,
        ownerEmail: email,
        collabEmail,
        password,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    const { closeDb } = await import("../db");
    await closeDb();
  })
  .catch(async (err) => {
    console.error(err);
    try {
      const { closeDb } = await import("../db");
      await closeDb();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
