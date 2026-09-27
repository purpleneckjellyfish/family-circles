import Link from "next/link";
import { eq } from "drizzle-orm";

import { SiteHeader } from "@/components/site-header";
import { ThrowbacksPanel } from "@/components/throwbacks-panel";
import { familyMemberships, getDb } from "@/db";
import { listLookbackIndex } from "@/lib/browse";
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

        <section id="events" className="mt-14">
          <h2 className="font-display text-2xl text-ink">Events</h2>
          {lookback.years.length === 0 ? (
            <p className="mt-3 text-ink-soft">
              Tag a memory with Christmas, a birthday, or another occasion and
              it will show up under that year.
            </p>
          ) : (
            lookback.years.map((group) => (
              <div key={group.year} className="mt-6">
                <h3 className="font-display text-xl text-ink">{group.year}</h3>
                <ul className="mt-1">
                  {group.events.map((event) => (
                    <li key={event.href}>
                      <TextLink href={event.href}>{event.title}</TextLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section id="people" className="mt-14">
          <h2 className="font-display text-2xl text-ink">People</h2>
          {lookback.people.length === 0 ? (
            <p className="mt-3 text-ink-soft">
              Add family members under People, then tag them on a memory.
            </p>
          ) : (
            <ul className="mt-2">
              {lookback.people.map((person) => (
                <li key={person.href}>
                  <TextLink href={person.href}>{person.title}</TextLink>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function TextLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center text-base text-ink underline-offset-4 hover:text-forest hover:underline"
    >
      {children}
    </Link>
  );
}
