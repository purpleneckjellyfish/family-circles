import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  albumPosts,
  albums,
  getDb,
  media,
  people,
  postPeople,
  posts,
} from "@/db";
import { loadPostsByIds, moderateFamilyIds, type FeedPost } from "@/lib/feed";

function effectiveYearExpr() {
  // Prefer memory_date year; fall back to posted_at calendar date (UTC).
  return sql<number>`extract(year from coalesce(${posts.memoryDate}, (${posts.postedAt} at time zone 'UTC')::date))::int`;
}

export async function listPeopleWithPostCounts(familyId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: people.id,
      displayName: people.displayName,
      birthday: people.birthday,
      postCount: sql<number>`count(distinct ${postPeople.postId})::int`,
    })
    .from(people)
    .leftJoin(postPeople, eq(postPeople.personId, people.id))
    .where(eq(people.familyId, familyId))
    .groupBy(people.id)
    .orderBy(people.displayName);

  return rows;
}

export async function listYearsWithPostCounts(
  familyId: string,
  userId: string,
) {
  const db = getDb();
  const modFamilies = await moderateFamilyIds(userId);
  const yearExpr = effectiveYearExpr();

  const rows = await db
    .select({
      year: yearExpr,
      postCount: sql<number>`count(*)::int`,
      hiddenCount: sql<number>`count(*) filter (where ${posts.hiddenAt} is not null)::int`,
    })
    .from(posts)
    .where(eq(posts.familyId, familyId))
    .groupBy(yearExpr)
    .orderBy(desc(yearExpr));

  return rows
    .map((r) => {
      const visibleCount = modFamilies.has(familyId)
        ? r.postCount
        : r.postCount - r.hiddenCount;
      return { year: r.year, postCount: visibleCount };
    })
    .filter((r) => r.postCount > 0 && r.year != null);
}

export async function listAlbumsWithPostCounts(familyId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: albums.id,
      title: albums.title,
      description: albums.description,
      postCount: sql<number>`count(${albumPosts.postId})::int`,
    })
    .from(albums)
    .leftJoin(albumPosts, eq(albumPosts.albumId, albums.id))
    .where(eq(albums.familyId, familyId))
    .groupBy(albums.id)
    .orderBy(albums.title);

  return rows;
}

export async function loadPostsForPerson(opts: {
  userId: string;
  familyId: string;
  personId: string;
}): Promise<FeedPost[]> {
  const db = getDb();
  const rows = await db
    .select({ postId: postPeople.postId })
    .from(postPeople)
    .innerJoin(posts, eq(posts.id, postPeople.postId))
    .where(
      and(
        eq(postPeople.personId, opts.personId),
        eq(posts.familyId, opts.familyId),
      ),
    )
    .orderBy(desc(posts.postedAt));

  return loadPostsByIds({
    userId: opts.userId,
    postIds: rows.map((r) => r.postId),
  });
}

export async function loadPostsForYear(opts: {
  userId: string;
  familyId: string;
  year: number;
}): Promise<FeedPost[]> {
  const db = getDb();
  const yearExpr = effectiveYearExpr();
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.familyId, opts.familyId), sql`${yearExpr} = ${opts.year}`))
    .orderBy(desc(posts.postedAt));

  return loadPostsByIds({
    userId: opts.userId,
    postIds: rows.map((r) => r.id),
  });
}

export async function listOccasionsWithPostCounts(
  familyId: string,
  userId: string,
) {
  const db = getDb();
  const modFamilies = await moderateFamilyIds(userId);
  const yearExpr = effectiveYearExpr();

  const rows = await db
    .select({
      occasion: posts.occasion,
      year: yearExpr,
      postCount: sql<number>`count(*)::int`,
      hiddenCount: sql<number>`count(*) filter (where ${posts.hiddenAt} is not null)::int`,
    })
    .from(posts)
    .where(
      and(eq(posts.familyId, familyId), sql`${posts.occasion} <> 'none'`),
    )
    .groupBy(posts.occasion, yearExpr)
    .orderBy(desc(yearExpr), posts.occasion);

  return rows
    .map((r) => {
      const visibleCount = modFamilies.has(familyId)
        ? r.postCount
        : r.postCount - r.hiddenCount;
      return {
        occasion: r.occasion,
        year: r.year,
        postCount: visibleCount,
      };
    })
    .filter((r) => r.postCount > 0 && r.year != null);
}

export async function loadPostsForOccasion(opts: {
  userId: string;
  familyId: string;
  occasion: "christmas" | "birthday" | "easter" | "other";
  year?: number;
}): Promise<FeedPost[]> {
  const db = getDb();
  const yearExpr = effectiveYearExpr();
  const conditions = [
    eq(posts.familyId, opts.familyId),
    eq(posts.occasion, opts.occasion),
  ];
  if (opts.year != null) {
    conditions.push(sql`${yearExpr} = ${opts.year}`);
  }
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.postedAt));

  return loadPostsByIds({
    userId: opts.userId,
    postIds: rows.map((r) => r.id),
  });
}

export type ExportMemory = {
  id: string;
  title: string | null;
  body: string | null;
  memoryDate: string | null;
  postedAt: string;
  authorName: string | null;
  people: string[];
  albums: string[];
  photos: Array<{
    id: string;
    fileName: string;
    storagePath: string;
    mimeType: string | null;
    width: number | null;
    height: number | null;
  }>;
};

/** All visible memories for ZIP export (moderators see hidden). */
export async function loadExportMemories(opts: {
  userId: string;
  familyId: string;
}): Promise<ExportMemory[]> {
  const postsHydrated = await loadPostsByIds({
    userId: opts.userId,
    postIds: (
      await getDb()
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.familyId, opts.familyId))
        .orderBy(desc(posts.postedAt))
    ).map((r) => r.id),
  });

  if (postsHydrated.length === 0) return [];

  const db = getDb();
  const mediaRows = await db
    .select()
    .from(media)
    .where(
      inArray(
        media.postId,
        postsHydrated.map((p) => p.id),
      ),
    )
    .orderBy(media.sortOrder);

  return postsHydrated.map((p) => {
    const photos = mediaRows
      .filter((m) => m.postId === p.id && m.storagePath)
      .map((m, idx) => {
        const ext =
          (m.storagePath!.includes(".")
            ? m.storagePath!.slice(m.storagePath!.lastIndexOf("."))
            : ".bin") || ".bin";
        return {
          id: m.id,
          fileName: `${p.id.slice(0, 8)}_${String(idx + 1).padStart(2, "0")}${ext}`,
          storagePath: m.storagePath!,
          mimeType: m.mimeType,
          width: m.width,
          height: m.height,
        };
      });

    return {
      id: p.id,
      title: p.title,
      body: p.body,
      memoryDate: p.memoryDate,
      postedAt: p.postedAt.toISOString(),
      authorName: p.authorName,
      people: p.people.map((x) => x.displayName),
      albums: p.albums.map((x) => x.title),
      photos,
    };
  });
}
