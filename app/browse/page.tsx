import Link from "next/link";
import { desc } from "drizzle-orm";

import { SiteHeader } from "@/components/site-header";
import { families, getDb } from "@/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Browse circles" };

export default async function BrowseFamiliesPage() {
  await requireUser();
  const db = getDb();
  const rows = await db
    .select({
      id: families.id,
      name: families.name,
      slug: families.slug,
      summary: families.summary,
    })
    .from(families)
    .orderBy(desc(families.createdAt))
    .limit(100);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <h1 className="font-display text-4xl font-semibold text-ink">
          Circles on this instance
        </h1>
        <p className="mt-3 text-ink-soft">
          Open a circle to follow as a collaborator, or ask an owner for an invite
          to join as a family member.
        </p>
        {rows.length === 0 ? (
          <p className="mt-8 text-ink-soft">No circles yet.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {rows.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/families/${f.slug}`}
                  className="block rounded-xl border border-border/80 bg-card/60 px-4 py-3 transition hover:border-forest/40"
                >
                  <span className="font-display text-xl text-ink">{f.name}</span>
                  {f.summary ? (
                    <p className="mt-1 text-sm text-ink-soft">{f.summary}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
