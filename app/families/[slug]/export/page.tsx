import Link from "next/link";

import { FamilySubnav } from "@/components/family-subnav";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { loadExportMemories } from "@/lib/browse";
import { requireFamilyView } from "@/lib/family-access";

export const metadata = { title: "Export" };

export default async function FamilyExportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, family } = await requireFamilyView(slug);
  const memories = await loadExportMemories({
    userId: user.id!,
    familyId: family.id,
  });
  const photoCount = memories.reduce((n, m) => n + m.photos.length, 0);

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
          Export
        </h1>
        <p className="mt-2 max-w-lg text-ink-soft">
          Download a ZIP of original photos plus captions, memory dates, people
          tags, and album names (JSON and CSV).
        </p>
        <FamilySubnav slug={slug} active="export" />

        <section className="mt-10 rounded-xl border border-border/80 bg-card/50 p-5">
          <p className="text-ink">
            {memories.length === 0
              ? "Nothing to export yet."
              : `${memories.length} ${
                  memories.length === 1 ? "memory" : "memories"
                }, ${photoCount} ${
                  photoCount === 1 ? "photo" : "photos"
                } ready.`}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Hidden collaborator posts are included only if you are an owner or
            adult.
          </p>
          <div className="mt-6">
            {memories.length === 0 ? (
              <Button disabled>Download ZIP</Button>
            ) : (
              <Button
                render={
                  <a
                    href={`/api/families/${slug}/export`}
                    download={`${family.slug}-export.zip`}
                  />
                }
              >
                Download ZIP
              </Button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
