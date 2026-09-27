import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <header className="animate-fc-fade relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <p className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Family Circles
        </p>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" render={<Link href="#about" />}>
            About
          </Button>
          <Button render={<Link href="#start" />}>Get started</Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-20 pt-6 sm:px-10 sm:pb-28">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="animate-fc-rise max-w-xl">
            <h1 className="font-display text-[clamp(2.75rem,8vw,5.25rem)] leading-[0.95] font-semibold text-ink">
              Family Circles
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft sm:text-xl">
              A private place for family photos and stories — on your own
              server, shared only with the people you invite.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3" id="start">
              <Button size="lg" render={<Link href="#start" />}>
                Create your circle
              </Button>
              <Button size="lg" variant="outline" render={<Link href="#about" />}>
                How it works
              </Button>
            </div>
            <p className="mt-5 text-sm text-ink-soft/80">
              Auth and invites arrive in the next phase. This shell is the
              foundation.
            </p>
          </div>

          <div
            className="animate-fc-rise animate-fc-drift relative mx-auto aspect-[4/5] w-full max-w-md lg:max-w-none"
            style={{ animationDelay: "120ms" }}
            aria-hidden
          >
            <div className="absolute inset-0 rotate-[-3deg] rounded-[1.25rem] bg-paper-deep shadow-[0_30px_60px_-35px_rgba(31,26,20,0.45)]" />
            <div className="absolute inset-3 rotate-[2.5deg] overflow-hidden rounded-[1rem] border border-border/70 bg-[linear-gradient(145deg,#d9e5dc_0%,#cbb89a_48%,#8fa99a_100%)] shadow-[0_24px_48px_-28px_rgba(31,26,20,0.55)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
              <div className="absolute inset-x-6 bottom-6 rounded-md bg-paper/85 px-4 py-3 backdrop-blur-sm">
                <p className="font-display text-lg text-ink">Summer at the lake</p>
                <p className="text-sm text-ink-soft">August 2019 · the kids</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section
        id="about"
        className="animate-fc-fade relative z-10 border-t border-border/70 bg-paper/50"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:px-10 md:grid-cols-3">
          <div>
            <h2 className="font-display text-2xl text-ink">Your circles</h2>
            <p className="mt-3 text-ink-soft leading-relaxed">
              Own a family circle, invite relatives, or follow another circle on
              the same instance.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink">Kept at home</h2>
            <p className="mt-3 text-ink-soft leading-relaxed">
              Self-hosted for Unraid and Docker. Originals stay on your disk
              under <code className="text-sm">/data</code>.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink">Ready to grow</h2>
            <p className="mt-3 text-ink-soft leading-relaxed">
              Schema is video-ready and federation-ready so later phases build
              on this foundation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
