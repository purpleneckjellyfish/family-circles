import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { SiteHeader } from "@/components/site-header";
import { FollowButton, InviteForm } from "@/components/family-forms";
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
import {
  canContribute,
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

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: familyMemberships.role,
    })
    .from(familyMemberships)
    .innerJoin(users, eq(users.id, familyMemberships.userId))
    .where(eq(familyMemberships.familyId, family.id));

  const myMembership = members.find((m) => m.id === user.id);
  const canInvite = canModerate(myMembership?.role);
  const familyMember = isFamilyMember(myMembership?.role);
  const mayPost = canContribute(myMembership?.role);
  const viewerCanModerate = canModerate(myMembership?.role);

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
            {family.summary ? (
              <p className="mt-2 max-w-lg text-ink-soft">{family.summary}</p>
            ) : null}
            {myMembership ? (
              <p className="mt-3 text-sm text-forest">
                Your role: <span className="font-medium">{myMembership.role}</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!familyMember ? (
              <FollowButton familyId={family.id} isFollowing={isFollowing} />
            ) : null}
            {mayPost ? (
              <Button render={<Link href={`/families/${slug}/posts/new`} />}>
                New memory
              </Button>
            ) : null}
          </div>
        </div>

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
                    showFamilyLink={false}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">People in the circle</h2>
          <ul className="mt-4 divide-y divide-border/70 rounded-xl border border-border/80 bg-card/50">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-ink">{m.name}</p>
                  <p className="text-sm text-ink-soft">{m.email}</p>
                </div>
                <span className="text-xs uppercase tracking-wide text-ink-soft">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {canInvite ? (
          <section className="mt-10">
            <h2 className="font-display text-2xl text-ink">Invites</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Family members join as adults. Collaborators join as followers and
              can contribute memories.
            </p>
            <div className="mt-4">
              <InviteForm familyId={family.id} appUrl={env.appUrl} />
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
