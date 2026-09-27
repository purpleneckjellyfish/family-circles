import Link from "next/link";
import { eq } from "drizzle-orm";

import {
  FollowerCanPostToggle,
  InviteForm,
} from "@/components/family-forms";
import { FamilySubnav } from "@/components/family-subnav";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { familyMemberships, getDb, users } from "@/db";
import { env } from "@/lib/env";
import { ensureLocalFamilyActor, isLocalFamily } from "@/lib/federation/actor";
import { familyActorUrl, webfingerAcct } from "@/lib/federation/urls";
import { requireFamilyView } from "@/lib/family-access";
import { canModerate, isOwner } from "@/lib/permissions";

export const metadata = { title: "Circle settings" };

export default async function FamilySettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { family, membership } = await requireFamilyView(slug);
  const remoteCircle = !isLocalFamily(family);
  const localActor = remoteCircle
    ? family
    : await ensureLocalFamilyActor(family.id);
  const canInvite = !remoteCircle && canModerate(membership?.role);
  const ownerViewer = isOwner(membership?.role);

  const members = await getDb()
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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href={`/families/${slug}`} className="hover:text-ink">
            ← {family.name}
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          Settings
        </h1>
        <p className="mt-2 text-ink-soft">
          Who is in {family.name}, who can post, and how to share it.
        </p>
        <FamilySubnav slug={slug} active="settings" />

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Members</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Followers can comment and react. Only the owner can let someone
            add photos.
          </p>
          <ul className="mt-4 divide-y divide-border/70 rounded-xl border border-border/80 bg-card/50">
            {members.length === 0 ? (
              <li className="px-4 py-3 text-ink-soft">No members yet.</li>
            ) : (
              members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-ink">{m.name}</p>
                    <p className="text-sm text-ink-soft">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {ownerViewer && m.role === "follower" ? (
                      <FollowerCanPostToggle
                        familyId={family.id}
                        userId={m.id}
                        canPost={m.canPost}
                        name={m.name}
                      />
                    ) : m.role === "follower" && m.canPost ? (
                      <span className="text-xs text-forest">Can add photos</span>
                    ) : null}
                    <span className="text-xs uppercase tracking-wide text-ink-soft">
                      {m.role}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        {canInvite ? (
          <section className="mt-10">
            <h2 className="font-display text-2xl text-ink">Invites</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Family members join as adults. Collaborators join as followers
              until you grant photo posting.
            </p>
            <div className="mt-4">
              <InviteForm familyId={family.id} appUrl={env.appUrl} />
            </div>
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Export</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Download originals plus captions, dates, and tags.
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              render={<Link href={`/families/${slug}/export`} />}
            >
              Download ZIP
            </Button>
          </div>
        </section>

        {canInvite ? (
          <p className="mt-10 text-xs text-ink-soft">
            Federated actor:{" "}
            <code className="text-[0.7rem]">
              {localActor.remoteUri || familyActorUrl(localActor.slug)}
            </code>
            {" · "}
            <code className="text-[0.7rem]">
              {webfingerAcct(localActor.slug)}
            </code>
          </p>
        ) : null}
      </main>
    </div>
  );
}
