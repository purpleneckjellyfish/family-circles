import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { PostCard } from "@/components/post-card";
import { SiteHeader } from "@/components/site-header";
import {
  albumPosts,
  albums,
  families,
  follows,
  getDb,
} from "@/db";
import { loadFeedPosts } from "@/lib/feed";
import { canModerate, getMembership } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ slug: string; albumId: string }>;
}) {
  const user = await requireUser();
  const { slug, albumId } = await params;
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

  const [album] = await db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.familyId, family.id)))
    .limit(1);
  if (!album) notFound();

  const links = await db
    .select({ postId: albumPosts.postId })
    .from(albumPosts)
    .where(eq(albumPosts.albumId, albumId));

  const all = await loadFeedPosts({
    userId: user.id!,
    familyId: family.id,
    limit: 100,
  });
  const idSet = new Set(links.map((l) => l.postId));
  const postsInAlbum = all.filter((p) => idSet.has(p.id));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href={`/families/${slug}/albums`} className="hover:text-ink">
            ← Albums
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          {album.title}
        </h1>
        {album.description ? (
          <p className="mt-2 text-ink-soft">{album.description}</p>
        ) : null}

        <div className="mt-8 space-y-4">
          {postsInAlbum.length === 0 ? (
            <p className="text-ink-soft">
              No memories in this album yet. Tag an album when you share a memory.
            </p>
          ) : (
            postsInAlbum.map((post) => (
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
