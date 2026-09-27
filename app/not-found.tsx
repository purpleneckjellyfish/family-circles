import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-6 sm:px-10">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
        >
          Family Circles
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-16">
        <h1 className="font-display text-4xl font-semibold text-ink">
          Page not found
        </h1>
        <p className="mt-3 text-ink-soft leading-relaxed">
          That link does not match a circle, memory, or settings page on this
          instance.
        </p>
        <div className="mt-8">
          <Button render={<Link href="/home" />}>Go home</Button>
        </div>
      </main>
    </div>
  );
}
