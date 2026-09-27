import { and, eq } from "drizzle-orm";

import { familyMemberships, getDb } from "@/db";

export type MembershipRole = "owner" | "adult" | "follower";

export async function getMembership(userId: string, familyId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(familyMemberships)
    .where(
      and(
        eq(familyMemberships.familyId, familyId),
        eq(familyMemberships.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function canContribute(role: MembershipRole | null | undefined) {
  return role === "owner" || role === "adult" || role === "follower";
}

export function canModerate(role: MembershipRole | null | undefined) {
  return role === "owner" || role === "adult";
}

export function isFamilyMember(role: MembershipRole | null | undefined) {
  return role === "owner" || role === "adult";
}
