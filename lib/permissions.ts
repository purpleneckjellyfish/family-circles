import { and, eq } from "drizzle-orm";

import { familyMemberships, follows, getDb } from "@/db";

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

export async function getAcceptedFollow(userId: string, familyId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.followerUserId, userId),
        eq(follows.familyId, familyId),
        eq(follows.status, "accepted"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Anyone in or following the circle can comment and react. */
export function canCommentOrReact(role: MembershipRole | null | undefined) {
  return role === "owner" || role === "adult" || role === "follower";
}

/**
 * @deprecated Prefer canCreatePost / canCommentOrReact.
 * Kept as alias for comment/react floor during transition.
 */
export function canContribute(role: MembershipRole | null | undefined) {
  return canCommentOrReact(role);
}

export function canModerate(role: MembershipRole | null | undefined) {
  return role === "owner" || role === "adult";
}

export function isFamilyMember(role: MembershipRole | null | undefined) {
  return role === "owner" || role === "adult";
}

export function isOwner(role: MembershipRole | null | undefined) {
  return role === "owner";
}

/**
 * Owner/adult always. Followers only when granted can_post on membership
 * and/or follow edge.
 */
export async function canCreatePost(
  userId: string,
  familyId: string,
): Promise<boolean> {
  const membership = await getMembership(userId, familyId);
  if (!membership) return false;
  if (membership.role === "owner" || membership.role === "adult") return true;
  if (membership.role === "follower" && membership.canPost) return true;

  const follow = await getAcceptedFollow(userId, familyId);
  return Boolean(follow?.canPost);
}

export function canEditPost(opts: {
  viewerRole: MembershipRole | null | undefined;
  viewerId: string;
  authorId: string | null;
}) {
  if (opts.viewerRole === "owner") return true;
  if (!opts.authorId) return false;
  if (
    (opts.viewerRole === "adult" || opts.viewerRole === "follower") &&
    opts.viewerId === opts.authorId
  ) {
    return true;
  }
  return false;
}

export function canDeletePost(opts: {
  viewerRole: MembershipRole | null | undefined;
  viewerId: string;
  authorId: string | null;
}) {
  return canEditPost(opts);
}

/** Owner deletes any; otherwise only own comments. */
export function canDeleteComment(opts: {
  viewerRole: MembershipRole | null | undefined;
  viewerId: string;
  authorId: string | null;
}) {
  if (opts.viewerRole === "owner") return true;
  return Boolean(opts.authorId && opts.viewerId === opts.authorId);
}

export function canEditComment(opts: {
  viewerId: string;
  authorId: string | null;
}) {
  return Boolean(opts.authorId && opts.viewerId === opts.authorId);
}

/** Circles the user may post memories into (for home composer). */
export async function familiesUserCanPostTo(userId: string) {
  const db = getDb();
  const memberships = await db
    .select()
    .from(familyMemberships)
    .where(eq(familyMemberships.userId, userId));

  const followRows = await db
    .select()
    .from(follows)
    .where(
      and(eq(follows.followerUserId, userId), eq(follows.status, "accepted")),
    );
  const followCanPost = new Set(
    followRows.filter((f) => f.canPost).map((f) => f.familyId),
  );

  return memberships.filter((m) => {
    if (m.role === "owner" || m.role === "adult") return true;
    if (m.role === "follower" && (m.canPost || followCanPost.has(m.familyId))) {
      return true;
    }
    return false;
  });
}
