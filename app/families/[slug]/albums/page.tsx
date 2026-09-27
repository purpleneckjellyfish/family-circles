import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import {
  CreateAlbumForm,
  DeleteAlbumButton,
} from "@/components/memory-admin-forms";
import { SiteHeader } from "@/components/site-header";
import { albums, families, follows, getDb } from "@/db";
import { canModerate, getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Albums" };

export default async function AlbumsPage({
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
    .from(albums)
    .where(eq(albums.familyId, family.id));

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
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">Albums</h1>
        <p className="mt-2 text-ink-soft">
          Group memories by trip, season, or celebration.
        </p>

        <ul className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <li className="text-ink-soft">No albums yet.</li>
          ) : (
            rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/families/${slug}/albums/${a.id}`}
                    className="font-display text-xl text-ink hover:text-forest"
                  >
                    {a.title}
                  </Link>
                  {a.description ? (
                    <p className="text-sm text-ink-soft">{a.description}</p>
                  ) : null}
                </div>
                {mayManage ? <DeleteAlbumButton albumId={a.id} /> : null}
              </li>
            ))
          )}
        </ul>

        {mayManage ? (
          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">New album</h2>
            <div className="mt-4">
              <CreateAlbumForm familyId={family.id} />
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
