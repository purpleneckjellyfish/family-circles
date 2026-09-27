import Link from "next/link";
import { desc } from "drizzle-orm";

import { FollowRemoteForm } from "@/components/follow-remote-form";
import { SiteHeader } from "@/components/site-header";
import { families, getDb } from "@/db";
import { localHost } from "@/lib/federation/urls";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Browse circles" };

export default async function BrowseFamiliesPage() {
  await requireUser();
  const db = getDb();
  const host = localHost();

  const all = await db
    .select({
      id: families.id,
      name: families.name,
      slug: families.slug,
      summary: families.summary,
      instanceHost: families.instanceHost,
      remoteUri: families.remoteUri,
    })
    .from(families)
    .orderBy(desc(families.createdAt))
    .limit(200);

  const localRows = all.filter(
    (f) => !f.instanceHost || f.instanceHost === host,
  );
  const remotes = all.filter(
    (f) => f.instanceHost && f.instanceHost !== host && f.remoteUri,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <h1 className="font-display text-4xl font-semibold text-ink">Circles</h1>
        <p className="mt-3 text-ink-soft">
          Local circles on this instance, plus remote Family Circles you follow.
        </p>

        <section className="mt-10 rounded-xl border border-border/80 bg-card/50 p-5">
          <h2 className="font-display text-2xl text-ink">
            Follow a remote circle
          </h2>
          <div className="mt-4">
            <FollowRemoteForm />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink">On this instance</h2>
          {localRows.length === 0 ? (
            <p className="mt-4 text-ink-soft">No local circles yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {localRows.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/families/${f.slug}`}
                    className="block rounded-xl border border-border/80 bg-card/60 px-4 py-3 transition hover:border-forest/40"
                  >
                    <span className="font-display text-xl text-ink">
                      {f.name}
                    </span>
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
          <h2 className="font-display text-2xl text-ink">Remote follows</h2>
          {remotes.length === 0 ? (
            <p className="mt-4 text-ink-soft">
              No remote circles yet. Paste a URL above after both hosts use
              HTTPS.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {remotes.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/families/${f.slug}`}
                    className="block rounded-xl border border-border/80 bg-card/60 px-4 py-3 transition hover:border-forest/40"
                  >
                    <span className="font-display text-xl text-ink">
                      {f.name}
                    </span>
                    <p className="mt-1 text-sm text-ink-soft">
                      {f.instanceHost}
                      {f.summary ? ` · ${f.summary}` : null}
                    </p>
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
