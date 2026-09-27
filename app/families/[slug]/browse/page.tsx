import Link from "next/link";

import { FamilySubnav } from "@/components/family-subnav";
import { SiteHeader } from "@/components/site-header";
import {
  listAlbumsWithPostCounts,
  listPeopleWithPostCounts,
  listYearsWithPostCounts,
} from "@/lib/browse";
import { requireFamilyView } from "@/lib/family-access";

export const metadata = { title: "Browse" };

export default async function FamilyBrowsePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, family } = await requireFamilyView(slug);

  const [peopleRows, yearRows, albumRows] = await Promise.all([
    listPeopleWithPostCounts(family.id),
    listYearsWithPostCounts(family.id, user.id!),
    listAlbumsWithPostCounts(family.id),
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
          Find memories by person, year, or album.
        </p>
        <FamilySubnav slug={slug} active="browse" />

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">By person</h2>
          {peopleRows.length === 0 ? (
            <p className="mt-3 text-ink-soft">
              No people tagged yet.{" "}
              <Link
                href={`/families/${slug}/people`}
                className="text-forest underline-offset-4 hover:underline"
              >
                Add people
              </Link>{" "}
              and tag them on memories.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/70 rounded-xl border border-border/80 bg-card/50">
              {peopleRows.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/families/${slug}/browse/people/${p.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-deep/40"
                  >
                    <span className="text-ink">{p.displayName}</span>
                    <span className="text-sm text-ink-soft">
                      {p.postCount === 1
                        ? "1 memory"
                        : `${p.postCount} memories`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">By year</h2>
          {yearRows.length === 0 ? (
            <p className="mt-3 text-ink-soft">
              No dated memories yet. Years use memory date, or posted date when
              memory date is blank.
            </p>
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
            <p className="mt-3 text-ink-soft">
              No albums yet.{" "}
              <Link
                href={`/families/${slug}/albums`}
                className="text-forest underline-offset-4 hover:underline"
              >
                Create an album
              </Link>
              .
            </p>
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
