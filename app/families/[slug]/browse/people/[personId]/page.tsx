import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/post-card";
import { SiteHeader } from "@/components/site-header";
import { getDb, people } from "@/db";
import { loadPostsForPerson } from "@/lib/browse";
import { requireFamilyView } from "@/lib/family-access";
import { canModerate } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; personId: string }>;
}) {
  const { personId } = await params;
  const [person] = await getDb()
    .select({ displayName: people.displayName })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  return { title: person?.displayName ?? "Person" };
}

export default async function BrowsePersonPage({
  params,
}: {
  params: Promise<{ slug: string; personId: string }>;
}) {
  const { slug, personId } = await params;
  const { user, family, membership } = await requireFamilyView(slug);
  const db = getDb();

  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.familyId, family.id)))
    .limit(1);
  if (!person) notFound();

  const posts = await loadPostsForPerson({
    userId: user.id!,
    familyId: family.id,
    personId: person.id,
  });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link
            href={`/families/${slug}/browse`}
            className="hover:text-ink"
          >
            ← Browse
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          {person.displayName}
        </h1>
        <p className="mt-2 text-ink-soft">
          {person.birthday
            ? `${person.displayName}'s timeline, newest first · birthday ${person.birthday}.`
            : `${person.displayName}'s timeline, newest first.`}
        </p>

        <div className="mt-8 space-y-4">
          {posts.length === 0 ? (
            <p className="text-ink-soft">
              No visible memories tagged with this person yet.
            </p>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                viewerCanModerate={canModerate(membership?.role)}
                showFamilyLink={false}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
