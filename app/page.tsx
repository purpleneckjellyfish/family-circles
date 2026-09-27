import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      {/* Full-bleed photo plane — warm lake/forest wash, not a floating card. */}
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        aria-hidden
      >
        <div className="absolute inset-0 animate-fc-soft-zoom bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,#8fa99a_0%,transparent_55%),linear-gradient(135deg,#cbb89a_0%,#d9e5dc_42%,#6f8f7c_100%)]" />
        <div className="absolute inset-0 animate-fc-drift bg-[radial-gradient(circle_at_20%_80%,rgba(243,239,230,0.55),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/85 to-paper/25 sm:via-paper/70" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper-deep/80 to-transparent" />
      </div>

      <SiteHeader />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-20 pt-6 sm:px-10 sm:pb-28">
        <section className="max-w-xl">
          <div className="animate-fc-rise">
            <h1 className="font-display text-[clamp(2.75rem,8vw,5.25rem)] leading-[0.95] font-semibold text-ink">
              Family Circles
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft sm:text-xl">
              A private place for family photos and stories — on your own
              server, shared only with the people you invite.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {user ? (
                <>
                  <Button size="lg" render={<Link href="/home" />}>
                    Go to your circles
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    render={<Link href="/families/new" />}
                  >
                    Create a circle
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" render={<Link href="/signup" />}>
                    Create your circle
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    render={<Link href="/login" />}
                  >
                    Sign in
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <p
          className="animate-fc-fade mt-16 max-w-sm font-display text-xl text-ink/80 sm:mt-24"
          style={{ animationDelay: "200ms" }}
        >
          Summer at the lake
          <span className="mt-1 block font-sans text-sm text-ink-soft">
            August 2019 · kept on your disk
          </span>
        </p>
      </main>

      <section
        id="about"
        className="animate-fc-fade relative z-10 border-t border-border/70 bg-paper/70 backdrop-blur-[2px]"
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
            <h2 className="font-display text-2xl text-ink">Roles that fit</h2>
            <p className="mt-3 text-ink-soft leading-relaxed">
              Owners and adults manage the circle; collaborators follow and can
              contribute when you invite them.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
