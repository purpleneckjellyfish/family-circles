import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  albumPosts,
  albums,
  comments,
  families,
  familyMemberships,
  follows,
  getDb,
  media,
  people,
  postPeople,
  posts,
  users,
} from "@/db";
import { canModerate } from "@/lib/permissions";

export type FeedPost = {
  id: string;
  body: string | null;
  memoryDate: string | null;
  postedAt: Date;
  hiddenAt: Date | null;
  familyId: string;
  familyName: string;
  familySlug: string;
  authorName: string | null;
  authorId: string | null;
  authorRole: "owner" | "adult" | "follower" | null;
  media: Array<{
    id: string;
    kind: "image" | "video";
    mimeType: string | null;
    width: number | null;
    height: number | null;
    sortOrder: number;
  }>;
  people: Array<{ id: string; displayName: string }>;
  albums: Array<{ id: string; title: string }>;
  commentCount: number;
};

async function familyIdsForUser(userId: string) {
  const db = getDb();
  const memberRows = await db
    .select({ familyId: familyMemberships.familyId })
    .from(familyMemberships)
    .where(eq(familyMemberships.userId, userId));
  const followRows = await db
    .select({ familyId: follows.familyId })
    .from(follows)
    .where(
      and(eq(follows.followerUserId, userId), eq(follows.status, "accepted")),
    );

  return [...new Set([...memberRows, ...followRows].map((r) => r.familyId))];
}

async function moderateFamilyIds(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      familyId: familyMemberships.familyId,
      role: familyMemberships.role,
    })
    .from(familyMemberships)
    .where(eq(familyMemberships.userId, userId));
  return new Set(
    rows.filter((r) => canModerate(r.role)).map((r) => r.familyId),
  );
}

export async function loadFeedPosts(opts: {
  userId: string;
  familyId?: string;
  limit?: number;
}): Promise<FeedPost[]> {
  const db = getDb();
  const familyIds = opts.familyId
    ? [opts.familyId]
    : await familyIdsForUser(opts.userId);
  if (familyIds.length === 0) return [];

  const modFamilies = await moderateFamilyIds(opts.userId);

  const rows = await db
    .select({
      id: posts.id,
      body: posts.body,
      memoryDate: posts.memoryDate,
      postedAt: posts.postedAt,
      hiddenAt: posts.hiddenAt,
      familyId: posts.familyId,
      familyName: families.name,
      familySlug: families.slug,
      authorName: users.name,
      authorId: users.id,
    })
    .from(posts)
    .innerJoin(families, eq(families.id, posts.familyId))
    .leftJoin(users, eq(users.id, posts.authorUserId))
    .where(inArray(posts.familyId, familyIds))
    .orderBy(desc(posts.postedAt))
    .limit(opts.limit ?? 50);

  // Hidden posts stay visible only to owners/adults of that circle.
  const visible = rows.filter(
    (r) => !r.hiddenAt || modFamilies.has(r.familyId),
  );
  if (visible.length === 0) return [];

  const postIds = visible.map((r) => r.id);

  const mediaRows = await db
    .select()
    .from(media)
    .where(inArray(media.postId, postIds))
    .orderBy(media.sortOrder);

  const peopleRows = await db
    .select({
      postId: postPeople.postId,
      id: people.id,
      displayName: people.displayName,
    })
    .from(postPeople)
    .innerJoin(people, eq(people.id, postPeople.personId))
    .where(inArray(postPeople.postId, postIds));

  const albumRows = await db
    .select({
      postId: albumPosts.postId,
      id: albums.id,
      title: albums.title,
    })
    .from(albumPosts)
    .innerJoin(albums, eq(albums.id, albumPosts.albumId))
    .where(inArray(albumPosts.postId, postIds));

  const commentRows = await db
    .select({
      postId: comments.postId,
      count: sql<number>`count(*)::int`,
    })
    .from(comments)
    .where(inArray(comments.postId, postIds))
    .groupBy(comments.postId);

  const commentMap = new Map(commentRows.map((c) => [c.postId, c.count]));

  const authorRoles = await db
    .select({
      familyId: familyMemberships.familyId,
      userId: familyMemberships.userId,
      role: familyMemberships.role,
    })
    .from(familyMemberships)
    .where(inArray(familyMemberships.familyId, familyIds));

  const roleKey = (familyId: string, userId: string) => `${familyId}:${userId}`;
  const roleMap = new Map(
    authorRoles.map((r) => [roleKey(r.familyId, r.userId), r.role]),
  );

  return visible.map((r) => ({
    id: r.id,
    body: r.body,
    memoryDate: r.memoryDate,
    postedAt: r.postedAt,
    hiddenAt: r.hiddenAt,
    familyId: r.familyId,
    familyName: r.familyName,
    familySlug: r.familySlug,
    authorName: r.authorName,
    authorId: r.authorId,
    authorRole: r.authorId
      ? (roleMap.get(roleKey(r.familyId, r.authorId)) ?? null)
      : null,
    media: mediaRows
      .filter((m) => m.postId === r.id)
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        mimeType: m.mimeType,
        width: m.width,
        height: m.height,
        sortOrder: m.sortOrder,
      })),
    people: peopleRows
      .filter((p) => p.postId === r.id)
      .map((p) => ({ id: p.id, displayName: p.displayName })),
    albums: albumRows
      .filter((a) => a.postId === r.id)
      .map((a) => ({ id: a.id, title: a.title })),
    commentCount: commentMap.get(r.id) ?? 0,
  }));
}
