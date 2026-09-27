import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { SiteHeader } from "@/components/site-header";
import { FollowButton } from "@/components/family-forms";
import { FamilySubnav } from "@/components/family-subnav";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/ui-states";
import { Button } from "@/components/ui/button";
import {
  families,
  familyMemberships,
  follows,
  getDb,
  users,
} from "@/db";
import { loadFeedPosts } from "@/lib/feed";
import { env } from "@/lib/env";
import { ensureLocalFamilyActor, isLocalFamily } from "@/lib/federation/actor";
import {
  canCreatePost,
  canDeletePost,
  canEditPost,
  canModerate,
  isFamilyMember,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: slug };
}

export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invites?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;
  const db = getDb();

  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.slug, slug))
    .limit(1);

  if (!family) notFound();

  const remoteCircle = !isLocalFamily(family);
  if (!remoteCircle) {
    await ensureLocalFamilyActor(family.id);
  }

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: familyMemberships.role,
      canPost: familyMemberships.canPost,
    })
    .from(familyMemberships)
    .innerJoin(users, eq(users.id, familyMemberships.userId))
    .where(eq(familyMemberships.familyId, family.id));

  const myMembership = members.find((m) => m.id === user.id);
  const familyMember = isFamilyMember(myMembership?.role);
  const mayPost =
    !remoteCircle && (await canCreatePost(user.id!, family.id));
  const viewerCanModerate = !remoteCircle && canModerate(myMembership?.role);

  const [myFollow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.familyId, family.id),
        eq(follows.followerUserId, user.id!),
      ),
    )
    .limit(1);

  const isFollowing = Boolean(myFollow) || myMembership?.role === "follower";
  const canView = Boolean(myMembership) || Boolean(myFollow);

  const feed = canView
    ? await loadFeedPosts({
        userId: user.id!,
        familyId: family.id,
        limit: 30,
      })
    : [];

  const freshInvites = (sp.invites ?? "")
    .split(",")
    .map((part) => {
      const [email, token] = part.split("|");
      if (!email || !token) return null;
      return { email: decodeURIComponent(email), token };
    })
    .filter((x): x is { email: string; token: string } => Boolean(x));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href="/home" className="hover:text-ink">
            ← Home
          </Link>
        </p>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold text-ink">
              {family.name}
            </h1>
            {remoteCircle ? (
              <p className="mt-2 text-sm text-ink-soft">
                Remote circle on{" "}
                <span className="font-medium text-ink">{family.instanceHost}</span>
                {family.allowFederatedComments
                  ? " · federated comments allowed"
                  : " · comments view-only"}
              </p>
            ) : null}
            {family.summary ? (
              <p className="mt-2 max-w-lg text-ink-soft">{family.summary}</p>
            ) : null}
            {myMembership ? (
              <p className="mt-3 text-sm text-forest">
                Your role: <span className="font-medium">{myMembership.role}</span>
                {myMembership.role === "follower" && myMembership.canPost
                  ? " · can add photos"
                  : null}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!familyMember && !remoteCircle ? (
              <FollowButton familyId={family.id} isFollowing={isFollowing} />
            ) : null}
            {remoteCircle && isFollowing ? (
              <FollowButton familyId={family.id} isFollowing />
            ) : null}
            {mayPost ? (
              <Button render={<Link href={`/families/${slug}/posts/new`} />}>
                New memory
              </Button>
            ) : null}
          </div>
        </div>

        {freshInvites.length > 0 ? (
          <section className="mt-6 rounded-xl border border-forest/30 bg-forest-soft/30 p-4">
            <h2 className="font-display text-xl text-ink">Adult invites ready</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Copy a link or open email for each adult you added.
            </p>
            <ul className="mt-3 space-y-3">
              {freshInvites.map((inv) => {
                const url = `${env.appUrl}/invite/${inv.token}`;
                const mailto = `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent(`Join ${family.name} on Family Circles`)}&body=${encodeURIComponent(`You're invited to ${family.name}.\n\n${url}\n`)}`;
                return (
                  <li
                    key={inv.token}
                    className="rounded-lg border border-border/70 bg-card/60 px-3 py-2"
                  >
                    <p className="text-sm text-ink">{inv.email}</p>
                    <p className="mt-1 break-all font-mono text-xs text-ink-soft">
                      {url}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<a href={mailto} />}
                      >
                        Open email
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {canView ? (
          <FamilySubnav slug={slug} active="feed" />
        ) : (
          <p className="mt-6 text-ink-soft">
            Follow this circle as a collaborator to see memories, or ask for an
            invite.
          </p>
        )}

        {canView ? (
          <section className="mt-10">
            <h2 className="font-display text-2xl text-ink">Memories</h2>
            {feed.length === 0 ? (
              <EmptyState
                className="mt-4"
                title="No memories yet"
                description="Share a photo or a short story to start this circle’s album."
                actionHref={mayPost ? `/families/${slug}/posts/new` : undefined}
                actionLabel={mayPost ? "Share the first memory" : undefined}
              />
            ) : (
              <div className="mt-4 space-y-5">
                {feed.map((post, i) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={i}
                    viewerCanModerate={viewerCanModerate}
                    viewerCanEdit={canEditPost({
                      viewerRole: myMembership?.role,
                      viewerId: user.id!,
                      authorId: post.authorId,
                    })}
                    viewerCanDelete={canDeletePost({
                      viewerRole: myMembership?.role,
                      viewerId: user.id!,
                      authorId: post.authorId,
                    })}
                    showFamilyLink={false}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

      </main>
    </div>
  );
}
