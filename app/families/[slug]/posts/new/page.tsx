import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { ComposePostForm } from "@/components/compose-post-form";
import { SiteHeader } from "@/components/site-header";
import { albums, families, getDb, people } from "@/db";
import { canCreatePost } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "New memory" };

export default async function NewPostPage({
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

  if (!(await canCreatePost(user.id!, family.id))) {
    redirect(`/families/${slug}`);
  }

  const peopleRows = await db
    .select({ id: people.id, displayName: people.displayName })
    .from(people)
    .where(eq(people.familyId, family.id));
  const albumRows = await db
    .select({ id: albums.id, title: albums.title })
    .from(albums)
    .where(eq(albums.familyId, family.id));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href={`/families/${slug}`} className="hover:text-ink">
            ← {family.name}
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          New memory
        </h1>
        <p className="mt-2 text-ink-soft">
          Caption, photos, people tags, or an occasion — same composer as Home.
        </p>
        <div className="mt-8">
          <ComposePostForm
            defaultFamilyId={family.id}
            circles={[
              {
                id: family.id,
                slug: family.slug,
                name: family.name,
                people: peopleRows,
                albums: albumRows,
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
