import Link from "next/link";

import { PostCard } from "@/components/post-card";
import type { ThrowbackMemory, ThrowbackMilestone } from "@/lib/throwbacks";

function yearsLabel(years: number, kind: "memory" | "milestone") {
  if (kind === "memory") {
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }
  if (years <= 0) return "Today";
  return years === 1 ? "1 year" : `${years} years`;
}

export function ThrowbacksPanel({
  todayLabel,
  memories,
  milestones,
  moderateFamilyIds,
  compact = false,
}: {
  todayLabel: string;
  memories: ThrowbackMemory[];
  milestones: ThrowbackMilestone[];
  moderateFamilyIds: Set<string>;
  compact?: boolean;
}) {
  const empty = memories.length === 0 && milestones.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-ink-soft">Looking back on {todayLabel}</p>
      </div>

      <section>
        <h3 className="font-display text-xl text-ink">Milestones today</h3>
        {milestones.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            No birthdays or anniversaries on this day in your circles.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {milestones.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-border/80 bg-card/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-ink">{m.title}</p>
                    <p className="text-sm text-ink-soft">
                      <Link
                        href={`/families/${m.familySlug}`}
                        className="hover:text-forest"
                      >
                        {m.familyName}
                      </Link>
                      {" · "}
                      {m.kind === "birthday"
                        ? "Birthday"
                        : m.kind === "anniversary"
                          ? "Anniversary"
                          : "Milestone"}
                      {m.years > 0 ? ` · ${yearsLabel(m.years, "milestone")}` : null}
                      {m.personName && m.kind !== "birthday"
                        ? ` · ${m.personName}`
                        : null}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-forest">
                    {m.occursOn.slice(5)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-display text-xl text-ink">On this day</h3>
        {memories.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            No memories from prior years on this date
            {compact ? " — check back as your album grows." : "."}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {memories.slice(0, compact ? 3 : undefined).map((item) => (
              <div key={item.post.id} className="space-y-2">
                <p className="text-sm font-medium text-forest">
                  {yearsLabel(item.yearsAgo, "memory")}
                  <span className="font-normal text-ink-soft">
                    {" "}
                    · {item.effectiveDate}
                  </span>
                </p>
                <PostCard
                  post={item.post}
                  viewerCanModerate={moderateFamilyIds.has(item.post.familyId)}
                />
              </div>
            ))}
            {compact && memories.length > 3 ? (
              <Link
                href="/throwbacks"
                className="inline-block text-sm text-forest underline-offset-4 hover:underline"
              >
                See all {memories.length} throwback memories →
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {empty && !compact ? (
        <p className="text-ink-soft">
          Add birthdays under People, anniversaries under Milestones, and tag
          memory dates on posts to fill this page over time.
        </p>
      ) : null}
    </div>
  );
}
