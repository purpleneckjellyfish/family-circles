import Link from "next/link";

import { FamilySubnav } from "@/components/family-subnav";
import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/ui-states";
import {
  listAlbumsWithPostCounts,
  listOccasionsWithPostCounts,
  listPeopleWithPostCounts,
  listYearsWithPostCounts,
} from "@/lib/browse";
import { requireFamilyView } from "@/lib/family-access";
import { occasionHref, occasionName } from "@/lib/occasions";

export const metadata = { title: "Browse" };

export default async function FamilyBrowsePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, family } = await requireFamilyView(slug);

  const [peopleRows, yearRows, albumRows, occasionRows] = await Promise.all([
    listPeopleWithPostCounts(family.id),
    listYearsWithPostCounts(family.id, user.id!),
    listAlbumsWithPostCounts(family.id),
    listOccasionsWithPostCounts(family.id, user.id!),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href={`/families/${slug}`} className="hover:text-ink">
            ← {family.name}
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          Browse
        </h1>
        <p className="mt-2 text-ink-soft">
          Find memories by person, year, occasion, or album.
        </p>
        <FamilySubnav slug={slug} active="browse" />

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">By occasion</h2>
          {occasionRows.length === 0 ? (
            <p className="mt-4 text-ink-soft">
              Tag Christmas, birthdays, and more when you share a memory.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {groupOccasions(slug, occasionRows).map((group) => (
                <div key={group.year}>
                  <h3 className="font-display text-xl text-ink">{group.year}</h3>
                  <ul className="mt-1">
                    {group.events.map((event) => (
                      <li key={event.href}>
                        <Link
                          href={event.href}
                          className="inline-flex min-h-11 items-center text-ink underline-offset-4 hover:text-forest hover:underline"
                        >
                          {event.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">By person</h2>
          {peopleRows.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No people tagged yet"
              description="Add kids and relatives, then tag them when you share a memory."
              actionHref={`/families/${slug}/people`}
              actionLabel="Add people"
            />
          ) : (
            <ul className="mt-2">
              {peopleRows.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/families/${slug}/browse/people/${p.id}`}
                    className="inline-flex min-h-11 items-center text-ink underline-offset-4 hover:text-forest hover:underline"
                  >
                    {p.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">By year</h2>
          {yearRows.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No dated memories yet"
              description="Years use the memory date when set, or the posted date when memory date is blank."
              actionHref={`/families/${slug}/posts/new`}
              actionLabel="Share a memory"
            />
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {yearRows.map((y) => (
                <li key={y.year}>
                  <Link
                    href={`/families/${slug}/browse/years/${y.year}`}
                    className="flex flex-col rounded-xl border border-border/80 bg-card/50 px-4 py-3 hover:border-forest/40"
                  >
                    <span className="font-display text-2xl text-ink">
                      {y.year}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {y.postCount === 1
                        ? "1 memory"
                        : `${y.postCount} memories`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">By album</h2>
          {albumRows.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No albums yet"
              description="Group memories by trip, season, or celebration."
              actionHref={`/families/${slug}/albums`}
              actionLabel="Create an album"
            />
          ) : (
            <ul className="mt-4 divide-y divide-border/70 rounded-xl border border-border/80 bg-card/50">
              {albumRows.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/families/${slug}/albums/${a.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-deep/40"
                  >
                    <span>
                      <span className="block text-ink">{a.title}</span>
                      {a.description ? (
                        <span className="block text-sm text-ink-soft">
                          {a.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm text-ink-soft">
                      {a.postCount === 1
                        ? "1 memory"
                        : `${a.postCount} memories`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function groupOccasions(
  slug: string,
  rows: Array<{ occasion: string; year: number | null }>,
) {
  const byYear = new Map<number, Array<{ href: string; title: string }>>();
  for (const row of rows) {
    if (row.year == null) continue;
    const events = byYear.get(row.year) ?? [];
    events.push({
      href: occasionHref(slug, row.occasion, row.year),
      title: occasionName(row.occasion),
    });
    byYear.set(row.year, events);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, events]) => ({
      year,
      events: events.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}
