import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Calm empty place — one purpose, one CTA, no dashboard chrome. */
export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-fc-rise rounded-2xl border border-dashed border-border/90 bg-card/40 px-5 py-10 text-center sm:px-8",
        className,
      )}
    >
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-ink-soft leading-relaxed">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <div className="mt-6">
          <Button render={<Link href={actionHref} />}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}

/** Inline alert for action / form failures. */
export function ErrorBanner({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={cn(
        "animate-fc-rise rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Skeleton placeholders while feed / browse pages stream in. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading memories">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-fc-pulse overflow-hidden rounded-xl border border-border/60 bg-card/50"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="aspect-[16/10] bg-paper-deep/80" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="animate-fc-pulse space-y-3" aria-hidden>
      <div className="h-10 w-48 rounded bg-muted" />
      <div className="h-4 w-72 max-w-full rounded bg-muted/80" />
    </div>
  );
}
