"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui-states";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-6 sm:px-10">
        <Link
          href="/home"
          className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
        >
          Family Circles
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-16 pt-8 sm:px-10">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Something went sideways
        </h1>
        <p className="mt-3 text-ink-soft leading-relaxed">
          That page hit an unexpected error. Your memories are still on disk —
          try again in a moment.
        </p>
        <div className="mt-4">
          <ErrorBanner>
            {error.message || "Unexpected application error."}
          </ErrorBanner>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button variant="outline" render={<Link href="/home" />}>
            Go home
          </Button>
        </div>
      </main>
    </div>
  );
}
