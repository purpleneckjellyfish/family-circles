import Link from "next/link";
import { eq } from "drizzle-orm";

import { SiteHeader } from "@/components/site-header";
import { ThrowbacksPanel } from "@/components/throwbacks-panel";
import { familyMemberships, getDb } from "@/db";
import { listLookbackIndex, type LookbackShortcut } from "@/lib/browse";
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

  const lookback = await listLookbackIndex(user.id!);
  const [y, m, d] = data.today.split("-").map(Number);
  const nice = new Date(y!, m! - 1, d!).toLocaleDateString("en-GB", {
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
          On this day, then the events and people you can open as their own
          timeline. The home feed stays in order.
        </p>
        <div className="mt-8">
          <ThrowbacksPanel
            todayLabel={nice}
            memories={data.memories}
            milestones={data.milestones}
            moderateFamilyIds={moderateIds}
          />
        </div>

        <LookbackList
          id="events"
          title="Events"
          empty="Tag a memory with Christmas, a birthday, or another occasion and that year will show up here."
          items={lookback.events}
        />
        <LookbackList
          id="people"
          title="People"
          empty="Tag someone on a memory and their photos will line up here, newest first."
          items={lookback.people}
        />
      </main>
    </div>
  );
}

function LookbackList({
  id,
  title,
  empty,
  items,
}: {
  id: string;
  title: string;
  empty: string;
  items: LookbackShortcut[];
}) {
  return (
    <section id={id} className="mt-14">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/70 rounded-xl border border-border/80 bg-card/50">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-paper-deep/40"
              >
                <span className="font-display text-xl text-ink">{item.title}</span>
                <span className="shrink-0 text-sm text-ink-soft">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
