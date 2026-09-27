import Link from "next/link";
import { eq } from "drizzle-orm";

import { SiteHeader } from "@/components/site-header";
import { ThrowbacksPanel } from "@/components/throwbacks-panel";
import { familyMemberships, getDb } from "@/db";
import { canModerate } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { loadThrowbacks } from "@/lib/throwbacks";

export const metadata = { title: "Throwbacks" };

export default async function ThrowbacksPage() {
  const user = await requireUser();
  const data = await loadThrowbacks({ userId: user.id! });

  const db = getDb();
  const memberships = await db
    .select({
      familyId: familyMemberships.familyId,
      role: familyMemberships.role,
    })
    .from(familyMemberships)
    .where(eq(familyMemberships.userId, user.id!));
  const moderateIds = new Set(
    memberships.filter((m) => canModerate(m.role)).map((m) => m.familyId),
  );

  const [y, m, d] = data.today.split("-").map(Number);
  const nice = new Date(y!, m! - 1, d!).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <p className="text-sm text-ink-soft">
          <Link href="/home" className="hover:text-ink">
            ← Home
          </Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">
          Throwbacks
        </h1>
        <p className="mt-2 text-ink-soft">
          Prior-year memories for this calendar day, plus birthdays and
          anniversaries in your circles.
        </p>
        <div className="mt-8">
          <ThrowbacksPanel
            todayLabel={nice}
            memories={data.memories}
            milestones={data.milestones}
            moderateFamilyIds={moderateIds}
          />
        </div>
      </main>
    </div>
  );
}
