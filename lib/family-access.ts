import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { families, follows, getDb } from "@/db";
import { getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

/** Load a family by slug and ensure the current user may view it. */
export async function requireFamilyView(slug: string) {
  const user = await requireUser();
  const db = getDb();
  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.slug, slug))
    .limit(1);
  if (!family) notFound();

  const membership = await getMembership(user.id!, family.id);
  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.familyId, family.id),
        eq(follows.followerUserId, user.id!),
      ),
    )
    .limit(1);

  if (!membership && !follow) {
    redirect(`/families/${slug}`);
  }

  return { user, family, membership, follow: follow ?? null };
}
