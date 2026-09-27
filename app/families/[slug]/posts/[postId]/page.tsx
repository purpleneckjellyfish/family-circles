import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { CommentForm, CommentListItem } from "@/components/comment-form";
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
  canCommentOrReact,
  canDeleteComment,
  canDeletePost,
  canEditComment,
  canEditPost,
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
      authorId: comments.authorUserId,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorUserId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  const mayComment =
    canCommentOrReact(membership?.role) || Boolean(follow);
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
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Comments</h2>
          <ul className="mt-4 space-y-4">
            {commentRows.length === 0 ? (
              <li className="text-ink-soft">No comments yet.</li>
            ) : (
              commentRows.map((c) => (
                <CommentListItem
                  key={c.id}
                  comment={{
                    id: c.id,
                    body: c.body,
                    createdAt: c.createdAt,
                    authorName: c.authorName,
                  }}
                  canEdit={canEditComment({
                    viewerId: user.id!,
                    authorId: c.authorId,
                  })}
                  canDelete={canDeleteComment({
                    viewerRole: membership?.role,
                    viewerId: user.id!,
                    authorId: c.authorId,
                  })}
                />
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
