import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/post-card";
import { SiteHeader } from "@/components/site-header";
import { loadPostsForOccasion } from "@/lib/browse";
import { requireFamilyView } from "@/lib/family-access";
import {
  canDeletePost,
  canEditPost,
  canModerate,
} from "@/lib/permissions";

const OCCASION_LABELS = {
  christmas: "Christmas",
  birthday: "Birthday",
  easter: "Easter",
  other: "Other occasions",
} as const;

type OccasionKey = keyof typeof OCCASION_LABELS;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ occasion: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { occasion } = await params;
  const sp = await searchParams;
  const label =
    OCCASION_LABELS[occasion as OccasionKey] ?? occasion;
  return {
    title: sp.year ? `${label} ${sp.year}` : label,
  };
}

export default async function BrowseOccasionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; occasion: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { slug, occasion: occasionParam } = await params;
  const sp = await searchParams;
  if (!(occasionParam in OCCASION_LABELS)) notFound();
  const occasion = occasionParam as OccasionKey;

  const year =
    sp.year != null && sp.year !== ""
      ? Number.parseInt(sp.year, 10)
      : undefined;
  if (
    year != null &&
    (!Number.isFinite(year) || year < 1800 || year > 2200)
  ) {
    notFound();
  }

  const { user, family, membership } = await requireFamilyView(slug);
  const posts = await loadPostsForOccasion({
    userId: user.id!,
    familyId: family.id,
    occasion,
    year,
  });

  const title = year
    ? `${OCCASION_LABELS[occasion]} ${year}`
    : OCCASION_LABELS[occasion];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href={`/families/${slug}/browse`} className="hover:text-ink">
            ← Browse
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          {title}
        </h1>
        <p className="mt-2 text-ink-soft">
          Memories tagged with this occasion
          {year ? ` in ${year}` : ""}, in the order they happened.
        </p>

        <div className="mt-8 space-y-4">
          {posts.length === 0 ? (
            <p className="text-ink-soft">No memories for this occasion yet.</p>
          ) : (
            posts.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                index={i}
                viewerCanModerate={canModerate(membership?.role)}
                viewerCanEdit={canEditPost({
                  viewerRole: membership?.role,
                  viewerId: user.id!,
                  authorId: post.authorId,
                })}
                viewerCanDelete={canDeletePost({
                  viewerRole: membership?.role,
                  viewerId: user.id!,
                  authorId: post.authorId,
                })}
                showFamilyLink={false}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
