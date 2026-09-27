import Link from "next/link";
import { and, eq } from "drizzle-orm";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { families, familyMemberships, follows, getDb } from "@/db";
import { requireUser } from "@/lib/session";

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
  const collaboratorMemberships = memberships.filter((m) => m.role === "follower");

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
              Your family circles and the ones you follow live here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/browse" />}>
              Browse
            </Button>
            <Button render={<Link href="/families/new" />}>New circle</Button>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">Your families</h2>
          {familyMembers.length === 0 ? (
            <p className="mt-3 text-ink-soft">
              No circles yet.{" "}
              <Link href="/families/new" className="text-forest underline-offset-4 hover:underline">
                Create one
              </Link>{" "}
              or accept an invite.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {familyMembers.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/families/${f.slug}`}
                    className="block rounded-xl border border-border/80 bg-card/60 px-4 py-3 transition hover:border-forest/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-xl text-ink">{f.name}</span>
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
          <h2 className="font-display text-2xl text-ink">Collaborating & following</h2>
          {collaboratorMemberships.length === 0 && followOnly.length === 0 ? (
            <p className="mt-3 text-ink-soft">
              Follow another circle on this instance, or accept a collaborator invite.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {[
                ...collaboratorMemberships.map((f) => ({
                  ...f,
                  badge: f.role as string,
                })),
                ...followOnly.map((f) => ({ ...f, badge: "following" })),
              ].map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/families/${f.slug}`}
                    className="block rounded-xl border border-border/80 bg-card/60 px-4 py-3 transition hover:border-forest/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-xl text-ink">{f.name}</span>
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
