import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { CommentForm } from "@/components/comment-form";
import { PostCard } from "@/components/post-card";
import { SiteHeader } from "@/components/site-header";
import {
  comments,
  families,
  follows,
  getDb,
  users,
} from "@/db";
import { loadFeedPosts } from "@/lib/feed";
import {
  canContribute,
  canModerate,
  getMembership,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { postId } = await params;
  return { title: `Memory · ${postId.slice(0, 8)}` };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const user = await requireUser();
  const { slug, postId } = await params;
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

  if (!membership && !follow) {
    redirect(`/families/${slug}`);
  }

  const feed = await loadFeedPosts({
    userId: user.id!,
    familyId: family.id,
    limit: 100,
  });
  const post = feed.find((p) => p.id === postId);
  if (!post) notFound();

  const commentRows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorName: users.name,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorUserId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  const mayComment = canContribute(membership?.role);
  const viewerCanModerate = canModerate(membership?.role);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href={`/families/${slug}`} className="hover:text-ink">
            ← {family.name}
          </Link>
        </p>
        <div className="mt-6">
          <PostCard
            post={post}
            viewerCanModerate={viewerCanModerate}
            showFamilyLink={false}
          />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Comments</h2>
          <ul className="mt-4 space-y-4">
            {commentRows.length === 0 ? (
              <li className="text-ink-soft">No comments yet.</li>
            ) : (
              commentRows.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-border/70 bg-card/50 px-4 py-3"
                >
                  <p className="text-sm text-ink-soft">
                    {c.authorName ?? "Someone"} ·{" "}
                    {c.createdAt.toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{c.body}</p>
                </li>
              ))
            )}
          </ul>
          {mayComment ? (
            <div className="mt-6">
              <CommentForm postId={postId} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">
              Join or follow this circle to comment.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
