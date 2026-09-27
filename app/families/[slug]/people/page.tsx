import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import {
  CreatePersonForm,
  DeletePersonButton,
} from "@/components/memory-admin-forms";
import { FamilySubnav } from "@/components/family-subnav";
import { SiteHeader } from "@/components/site-header";
import { families, follows, getDb, people } from "@/db";
import { canModerate, getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "People" };

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
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
  if (!membership && !follow) redirect(`/families/${slug}`);

  const rows = await db
    .select()
    .from(people)
    .where(eq(people.familyId, family.id));

  const mayManage = canModerate(membership?.role);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href={`/families/${slug}`} className="hover:text-ink">
            ← {family.name}
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">People</h1>
        <p className="mt-2 text-ink-soft">
          Tag kids and relatives on memories — no account required.
        </p>
        <FamilySubnav slug={slug} active="people" />

        <ul className="mt-8 divide-y divide-border/70 rounded-xl border border-border/80 bg-card/50">
          {rows.length === 0 ? (
            <li className="px-4 py-3 text-ink-soft">No people yet.</li>
          ) : (
            rows.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/families/${slug}/browse/people/${p.id}`}
                    className="text-ink hover:text-forest"
                  >
                    {p.displayName}
                  </Link>
                  {p.birthday ? (
                    <p className="text-sm text-ink-soft">Birthday {p.birthday}</p>
                  ) : null}
                </div>
                {mayManage ? <DeletePersonButton personId={p.id} /> : null}
              </li>
            ))
          )}
        </ul>

        {mayManage ? (
          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">Add someone</h2>
            <div className="mt-4">
              <CreatePersonForm familyId={family.id} />
            </div>
          </section>
        ) : (
          <p className="mt-8 text-sm text-ink-soft">
            Owners and adults manage the people list.
          </p>
        )}
      </main>
    </div>
  );
}
