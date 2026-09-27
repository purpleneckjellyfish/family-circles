import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  albumPosts,
  albums,
  families,
  familyMemberships,
  follows,
  getDb,
  media,
  people,
  postPeople,
  posts,
} from "@/db";
import { loadPostsByIds, moderateFamilyIds, type FeedPost } from "@/lib/feed";
import { occasionBrowseTitle, occasionHref } from "@/lib/occasions";

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
    .orderBy(desc(happenedOn()), desc(posts.postedAt));

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
    .orderBy(desc(happenedOn()), desc(posts.postedAt));

  return loadPostsByIds({
    userId: opts.userId,
    postIds: rows.map((r) => r.id),
  });
}

function happenedOn() {
  return sql`coalesce(${posts.memoryDate}, (${posts.postedAt} at time zone 'UTC')::date)`;
}

function memoryCount(count: number) {
  return count === 1 ? "1 memory" : `${count} memories`;
}

export type LookbackShortcut = {
  href: string;
  title: string;
  detail: string;
};

/** Occasions and tagged people across every circle the viewer can open. */
export async function listLookbackIndex(userId: string): Promise<{
  events: LookbackShortcut[];
  people: LookbackShortcut[];
}> {
  const db = getDb();
  const memberships = await db
    .select({
      id: families.id,
      name: families.name,
      slug: families.slug,
    })
    .from(familyMemberships)
    .innerJoin(families, eq(families.id, familyMemberships.familyId))
    .where(eq(familyMemberships.userId, userId));

  const following = await db
    .select({
      id: families.id,
      name: families.name,
      slug: families.slug,
    })
    .from(follows)
    .innerJoin(families, eq(families.id, follows.familyId))
    .where(
      and(eq(follows.followerUserId, userId), eq(follows.status, "accepted")),
    );

  const circles = new Map<string, { id: string; name: string; slug: string }>();
  for (const circle of [...memberships, ...following]) {
    circles.set(circle.id, circle);
  }

  const buckets = await Promise.all(
    [...circles.values()].map(async (circle) => {
      const [occasions, peopleRows] = await Promise.all([
        listOccasionsWithPostCounts(circle.id, userId),
        listPeopleWithPostCounts(circle.id),
      ]);
      return { circle, occasions, peopleRows };
    }),
  );

  const several = circles.size > 1;
  const events: Array<LookbackShortcut & { year: number }> = [];
  const peopleShortcuts: LookbackShortcut[] = [];

  for (const { circle, occasions, peopleRows } of buckets) {
    for (const occasion of occasions) {
      if (occasion.year == null) continue;
      events.push({
        href: occasionHref(circle.slug, occasion.occasion, occasion.year),
        title: occasionBrowseTitle(occasion.occasion, occasion.year),
        detail: several
          ? `${circle.name} · ${memoryCount(occasion.postCount)}`
          : memoryCount(occasion.postCount),
        year: occasion.year,
      });
    }
    for (const person of peopleRows) {
      if (person.postCount < 1) continue;
      peopleShortcuts.push({
        href: `/families/${circle.slug}/browse/people/${person.id}`,
        title: person.displayName,
        detail: several
          ? `${circle.name} · ${memoryCount(person.postCount)}`
          : memoryCount(person.postCount),
      });
    }
  }

  events.sort(
    (a, b) => b.year - a.year || a.title.localeCompare(b.title),
  );
  peopleShortcuts.sort((a, b) => a.title.localeCompare(b.title));

  return {
    events: events.map(({ href, title, detail }) => ({ href, title, detail })),
    people: peopleShortcuts,
  };
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
