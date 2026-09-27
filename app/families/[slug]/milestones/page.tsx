import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import {
  CreateMilestoneForm,
  DeleteMilestoneButton,
} from "@/components/milestone-forms";
import { SiteHeader } from "@/components/site-header";
import {
  families,
  follows,
  getDb,
  milestones,
  people,
} from "@/db";
import { canModerate, getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Milestones" };

export default async function MilestonesPage({
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
    .select({
      id: milestones.id,
      title: milestones.title,
      kind: milestones.kind,
      occursOn: milestones.occursOn,
      personName: people.displayName,
    })
    .from(milestones)
    .leftJoin(people, eq(people.id, milestones.personId))
    .where(eq(milestones.familyId, family.id));

  const peopleRows = await db
    .select({ id: people.id, displayName: people.displayName })
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
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          Milestones
        </h1>
        <p className="mt-2 text-ink-soft">
          Anniversaries and other recurring dates for throwbacks. Birthdays live
          on{" "}
          <Link
            href={`/families/${slug}/people`}
            className="text-forest underline-offset-4 hover:underline"
          >
            People
          </Link>
          .
        </p>

        <ul className="mt-8 divide-y divide-border/70 rounded-xl border border-border/80 bg-card/50">
          {rows.length === 0 ? (
            <li className="px-4 py-3 text-ink-soft">No milestones yet.</li>
          ) : (
            rows.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-ink">{m.title}</p>
                  <p className="text-sm text-ink-soft">
                    {m.kind === "anniversary" ? "Anniversary" : "Other"} ·{" "}
                    {m.occursOn}
                    {m.personName ? ` · ${m.personName}` : null}
                  </p>
                </div>
                {mayManage ? <DeleteMilestoneButton milestoneId={m.id} /> : null}
              </li>
            ))
          )}
        </ul>

        {mayManage ? (
          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">Add milestone</h2>
            <div className="mt-4">
              <CreateMilestoneForm familyId={family.id} people={peopleRows} />
            </div>
          </section>
        ) : (
          <p className="mt-8 text-sm text-ink-soft">
            Owners and adults manage milestones.
          </p>
        )}
      </main>
    </div>
  );
}
