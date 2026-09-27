import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/post-card";
import { SiteHeader } from "@/components/site-header";
import { loadPostsForYear } from "@/lib/browse";
import { requireFamilyView } from "@/lib/family-access";
import { canModerate } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  return { title: year };
}

export default async function BrowseYearPage({
  params,
}: {
  params: Promise<{ slug: string; year: string }>;
}) {
  const { slug, year: yearParam } = await params;
  const year = Number.parseInt(yearParam, 10);
  if (!Number.isFinite(year) || year < 1800 || year > 2200) notFound();

  const { user, family, membership } = await requireFamilyView(slug);
  const posts = await loadPostsForYear({
    userId: user.id!,
    familyId: family.id,
    year,
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
          {year}
        </h1>
        <p className="mt-2 text-ink-soft">
          Memories by memory date (or posted date when memory date is blank).
        </p>

        <div className="mt-8 space-y-4">
          {posts.length === 0 ? (
            <p className="text-ink-soft">No visible memories for this year.</p>
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
