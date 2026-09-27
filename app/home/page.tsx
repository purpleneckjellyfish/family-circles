import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";

import {
  ComposePostForm,
  type ComposerCircle,
} from "@/components/compose-post-form";
import { PostCard } from "@/components/post-card";
import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/ui-states";
import { Button } from "@/components/ui/button";
import {
  albums,
  families,
  familyMemberships,
  follows,
  getDb,
  people,
} from "@/db";
import { loadFeedPosts } from "@/lib/feed";
import {
  canDeletePost,
  canEditPost,
  canModerate,
  familiesUserCanPostTo,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { loadThrowbacks } from "@/lib/throwbacks";

export const metadata = { title: "Home" };

export default async function AppHomePage() {
  const user = await requireUser();
  const db = getDb();

  const memberships = await db
    .select({
      id: families.id,
      name: families.name,
      slug: families.slug,
      summary: families.summary,
      role: familyMemberships.role,
      canPost: familyMemberships.canPost,
    })
    .from(familyMemberships)
    .innerJoin(families, eq(families.id, familyMemberships.familyId))
    .where(eq(familyMemberships.userId, user.id!));

  const following = await db
    .select({
      id: families.id,
      name: families.name,
      slug: families.slug,
      summary: families.summary,
    })
    .from(follows)
    .innerJoin(families, eq(families.id, follows.familyId))
    .where(
      and(eq(follows.followerUserId, user.id!), eq(follows.status, "accepted")),
    );

  const memberIds = new Set(memberships.map((m) => m.id));
  const followOnly = following.filter((f) => !memberIds.has(f.id));
  const familyMembers = memberships.filter(
    (m) => m.role === "owner" || m.role === "adult",
  );
  const collaboratorMemberships = memberships.filter(
    (m) => m.role === "follower",
  );

  const feed = await loadFeedPosts({ userId: user.id!, limit: 40 });
  const throwbacks = await loadThrowbacks({ userId: user.id! });
  const moderateFamilies = new Set(
    memberships.filter((m) => canModerate(m.role)).map((m) => m.id),
  );
  const roleByFamily = new Map(memberships.map((m) => [m.id, m.role]));

  const postable = await familiesUserCanPostTo(user.id!);
  const postableIds = postable.map((p) => p.familyId);
  let composerCircles: ComposerCircle[] = [];
  if (postableIds.length > 0) {
    const circleRows = await db
      .select({
        id: families.id,
        slug: families.slug,
        name: families.name,
      })
      .from(families)
      .where(inArray(families.id, postableIds));
    const peopleRows = await db
      .select({
        id: people.id,
        familyId: people.familyId,
        displayName: people.displayName,
      })
      .from(people)
      .where(inArray(people.familyId, postableIds));
    const albumRows = await db
      .select({
        id: albums.id,
        familyId: albums.familyId,
        title: albums.title,
      })
      .from(albums)
      .where(inArray(albums.familyId, postableIds));

    composerCircles = circleRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      people: peopleRows
        .filter((p) => p.familyId === c.id)
        .map((p) => ({ id: p.id, displayName: p.displayName })),
      albums: albumRows
        .filter((a) => a.familyId === c.id)
        .map((a) => ({ id: a.id, title: a.title })),
    }));
  }

  const feedIds = new Set(feed.map((p) => p.id));
  const throwbackItems = throwbacks.memories
    .filter((t) => !feedIds.has(t.post.id))
    .map((t) => ({
      kind: "throwback" as const,
      post: t.post,
      yearsAgo: t.yearsAgo,
    }));
  const postItems = feed.map((post) => ({
    kind: "post" as const,
    post,
  }));
  // Throwbacks first (on-this-day), then chronological feed
  const ordered = [...throwbackItems, ...postItems];

  const firstFamily = familyMembers[0] ?? collaboratorMemberships[0];
  const [y, m, d] = throwbacks.today.split("-").map(Number);
  const throwbackDayLabel = new Date(y!, m! - 1, d!).toLocaleDateString(
    undefined,
    { month: "long", day: "numeric" },
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold text-ink">
              Hello, {user.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="mt-2 text-ink-soft">
              Memories from your circles
              {throwbacks.memories.length > 0
                ? ` · throwbacks for ${throwbackDayLabel}`
                : ""}
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/throwbacks" />}>
              Throwbacks
            </Button>
            <Button variant="outline" render={<Link href="/browse" />}>
              Browse
            </Button>
            {!composerCircles.length ? (
              <Button render={<Link href="/families/new" />}>New circle</Button>
            ) : null}
          </div>
        </div>

        {composerCircles.length > 0 ? (
          <section className="mt-8">
            <ComposePostForm circles={composerCircles} compact />
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Feed</h2>
          {ordered.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No memories yet"
              description="Create a circle or follow one, then share a photo or story. This feed gathers everything you belong to."
              actionHref={
                firstFamily
                  ? `/families/${firstFamily.slug}/posts/new`
                  : "/families/new"
              }
              actionLabel={firstFamily ? "Share a memory" : "Create a circle"}
            />
          ) : (
            <div className="mt-4 space-y-5">
              {ordered.map((item, i) => {
                const role = roleByFamily.get(item.post.familyId);
                const canEdit = canEditPost({
                  viewerRole: role,
                  viewerId: user.id!,
                  authorId: item.post.authorId,
                });
                const canDelete = canDeletePost({
                  viewerRole: role,
                  viewerId: user.id!,
                  authorId: item.post.authorId,
                });
                return (
                  <PostCard
                    key={`${item.kind}-${item.post.id}`}
                    post={item.post}
                    index={i}
                    viewerCanModerate={moderateFamilies.has(item.post.familyId)}
                    viewerCanEdit={canEdit}
                    viewerCanDelete={canDelete}
                    throwbackYearsAgo={
                      item.kind === "throwback" ? item.yearsAgo : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-14">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl text-ink">Your families</h2>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/families/new" />}
            >
              New circle
            </Button>
          </div>
          {familyMembers.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No circles yet"
              description="Start a private family circle, or accept an invite from someone who already has one."
              actionHref="/families/new"
              actionLabel="Create a circle"
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {familyMembers.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/families/${f.slug}`}
                    className="block rounded-xl border border-border/80 bg-card/60 px-4 py-3 transition hover:border-forest/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-xl text-ink">
                        {f.name}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-ink-soft">
                        {f.role}
                      </span>
                    </div>
                    {f.summary ? (
                      <p className="mt-1 text-sm text-ink-soft">{f.summary}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">
            Collaborating & following
          </h2>
          {collaboratorMemberships.length === 0 && followOnly.length === 0 ? (
            <p className="mt-3 text-ink-soft">
              Follow another circle on this instance, or accept a collaborator
              invite. Followers browse quietly unless an owner grants photo
              posting.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {[
                ...collaboratorMemberships.map((f) => ({
                  ...f,
                  badge: f.canPost ? "can post" : "follower",
                })),
                ...followOnly.map((f) => ({ ...f, badge: "following" })),
              ].map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/families/${f.slug}`}
                    className="block rounded-xl border border-border/80 bg-card/60 px-4 py-3 transition hover:border-forest/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-xl text-ink">
                        {f.name}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-ink-soft">
                        {f.badge}
                      </span>
                    </div>
                    {f.summary ? (
                      <p className="mt-1 text-sm text-ink-soft">{f.summary}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
