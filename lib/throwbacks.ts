import { and, eq, inArray, sql } from "drizzle-orm";

import {
  families,
  getDb,
  milestones,
  people,
  posts,
} from "@/db";
import {
  familyIdsForUser,
  loadPostsByIds,
  moderateFamilyIds,
  type FeedPost,
} from "@/lib/feed";

export type ThrowbackMemory = {
  post: FeedPost;
  /** Calendar date used for the match (memory date, else posted date). */
  effectiveDate: string;
  yearsAgo: number;
};

export type ThrowbackMilestone = {
  id: string;
  kind: "birthday" | "anniversary" | "other";
  title: string;
  occursOn: string;
  years: number;
  familyId: string;
  familyName: string;
  familySlug: string;
  personName: string | null;
};

export type ThrowbacksResult = {
  /** YYYY-MM-DD in local server TZ for display; matching uses this calendar day. */
  today: string;
  month: number;
  day: number;
  memories: ThrowbackMemory[];
  milestones: ThrowbackMilestone[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function calendarParts(date = new Date()) {
  // Use local calendar day so Unraid hosts see "today" in their TZ.
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return {
    year,
    month,
    day,
    iso: `${year}-${pad2(month)}-${pad2(day)}`,
  };
}

function yearsBetween(fromIsoDate: string, toYear: number, toMonth: number, toDay: number) {
  const [y, m, d] = fromIsoDate.split("-").map(Number);
  if (!y || !m || !d) return 0;
  let years = toYear - y;
  if (toMonth < m || (toMonth === m && toDay < d)) years -= 1;
  return Math.max(0, years);
}

/**
 * On-this-day memories (prior years) + birthday/anniversary milestones for today.
 * Memory match prefers memory_date; falls back to posted_at date.
 */
export async function loadThrowbacks(opts: {
  userId: string;
  familyId?: string;
  /** Override "today" for tests (YYYY-MM-DD). */
  onDate?: string;
}): Promise<ThrowbacksResult> {
  const parts = opts.onDate
    ? (() => {
        const [y, m, d] = opts.onDate!.split("-").map(Number);
        return { year: y!, month: m!, day: d!, iso: opts.onDate! };
      })()
    : calendarParts();

  const familyIds = opts.familyId
    ? [opts.familyId]
    : await familyIdsForUser(opts.userId);

  if (familyIds.length === 0) {
    return {
      today: parts.iso,
      month: parts.month,
      day: parts.day,
      memories: [],
      milestones: [],
    };
  }

  const db = getDb();
  const modFamilies = await moderateFamilyIds(opts.userId);

  // Prefer memory_date month/day; else posted_at::date. Only prior years.
  const memoryRows = await db
    .select({
      id: posts.id,
      memoryDate: posts.memoryDate,
      postedAt: posts.postedAt,
      hiddenAt: posts.hiddenAt,
      familyId: posts.familyId,
    })
    .from(posts)
    .where(
      and(
        inArray(posts.familyId, familyIds),
        sql`
          (
            (
              ${posts.memoryDate} is not null
              and extract(month from ${posts.memoryDate}) = ${parts.month}
              and extract(day from ${posts.memoryDate}) = ${parts.day}
              and extract(year from ${posts.memoryDate}) < ${parts.year}
            )
            or
            (
              ${posts.memoryDate} is null
              and extract(month from (${posts.postedAt} at time zone 'UTC')::date) = ${parts.month}
              and extract(day from (${posts.postedAt} at time zone 'UTC')::date) = ${parts.day}
              and extract(year from (${posts.postedAt} at time zone 'UTC')::date) < ${parts.year}
            )
          )
        `,
      ),
    );

  const visibleMemoryIds = memoryRows
    .filter((r) => !r.hiddenAt || modFamilies.has(r.familyId))
    .map((r) => r.id);

  const hydrated = await loadPostsByIds({
    userId: opts.userId,
    postIds: visibleMemoryIds,
  });

  const meta = new Map(
    memoryRows.map((r) => {
      const effective =
        r.memoryDate ??
        r.postedAt.toISOString().slice(0, 10);
      const year = Number(effective.slice(0, 4));
      return [
        r.id,
        {
          effectiveDate: effective,
          yearsAgo: Math.max(1, parts.year - year),
        },
      ] as const;
    }),
  );

  const memories: ThrowbackMemory[] = hydrated
    .map((post) => {
      const m = meta.get(post.id);
      if (!m) return null;
      return { post, ...m };
    })
    .filter((x): x is ThrowbackMemory => Boolean(x))
    .sort((a, b) => b.yearsAgo - a.yearsAgo || b.post.postedAt.getTime() - a.post.postedAt.getTime());

  // Birthdays from people tags in accessible families.
  const birthdayRows = await db
    .select({
      id: people.id,
      displayName: people.displayName,
      birthday: people.birthday,
      familyId: people.familyId,
      familyName: families.name,
      familySlug: families.slug,
    })
    .from(people)
    .innerJoin(families, eq(families.id, people.familyId))
    .where(
      and(
        inArray(people.familyId, familyIds),
        sql`
          ${people.birthday} is not null
          and extract(month from ${people.birthday}) = ${parts.month}
          and extract(day from ${people.birthday}) = ${parts.day}
        `,
      ),
    );

  const milestoneRows = await db
    .select({
      id: milestones.id,
      title: milestones.title,
      kind: milestones.kind,
      occursOn: milestones.occursOn,
      familyId: milestones.familyId,
      familyName: families.name,
      familySlug: families.slug,
      personName: people.displayName,
    })
    .from(milestones)
    .innerJoin(families, eq(families.id, milestones.familyId))
    .leftJoin(people, eq(people.id, milestones.personId))
    .where(
      and(
        inArray(milestones.familyId, familyIds),
        sql`
          extract(month from ${milestones.occursOn}) = ${parts.month}
          and extract(day from ${milestones.occursOn}) = ${parts.day}
        `,
      ),
    );

  const milestoneItems: ThrowbackMilestone[] = [
    ...birthdayRows.map((b) => ({
      id: `birthday:${b.id}`,
      kind: "birthday" as const,
      title: `${b.displayName}'s birthday`,
      occursOn: b.birthday!,
      years: yearsBetween(b.birthday!, parts.year, parts.month, parts.day),
      familyId: b.familyId,
      familyName: b.familyName,
      familySlug: b.familySlug,
      personName: b.displayName,
    })),
    ...milestoneRows.map((m) => ({
      id: m.id,
      kind: m.kind === "anniversary" ? ("anniversary" as const) : ("other" as const),
      title: m.title,
      occursOn: m.occursOn,
      years: yearsBetween(m.occursOn, parts.year, parts.month, parts.day),
      familyId: m.familyId,
      familyName: m.familyName,
      familySlug: m.familySlug,
      personName: m.personName,
    })),
  ].sort((a, b) => a.title.localeCompare(b.title));

  return {
    today: parts.iso,
    month: parts.month,
    day: parts.day,
    memories,
    milestones: milestoneItems,
  };
}
