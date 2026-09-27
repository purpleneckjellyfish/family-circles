"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { logoutAction } from "@/lib/actions/auth";
import { familyNavLinks } from "@/components/family-subnav";
import { cn } from "@/lib/utils";

export type MenuCircle = {
  name: string;
  slug: string;
  badge: string;
};

export type MenuLink = {
  href: string;
  title: string;
};

export type MenuYear = {
  year: number;
  events: MenuLink[];
};

const appLinks = [
  { href: "/home", label: "Home" },
  { href: "/throwbacks", label: "Throwbacks" },
  { href: "/settings", label: "Settings" },
] as const;

function linkClass(active: boolean) {
  return cn(
    "flex min-h-11 items-center rounded-lg px-3 text-base",
    active ? "bg-forest-soft font-medium text-forest" : "text-ink hover:bg-muted",
  );
}

/** Phone menu: app links, circles, and the current circle. Wide screens keep the header. */
export function AppMenu({
  signedIn,
  name,
  circles,
  years,
  people,
}: {
  signedIn: boolean;
  name?: string | null;
  circles: MenuCircle[];
  years: MenuYear[];
  people: MenuLink[];
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSearch(window.location.search);
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const circleMatch = pathname.match(/^\/families\/([^/]+)/);
  const circleSlug =
    circleMatch && circleMatch[1] !== "new" ? circleMatch[1] : null;
  const currentCircle = circles.find((circle) => circle.slug === circleSlug);

  const panel = open ? (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-ink/40"
        aria-label="Close menu"
        onClick={() => setOpen(false)}
      />
      <nav
        id="app-menu"
        className="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,88vw)] flex-col overflow-y-auto border-l border-border bg-paper px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[-12px_0_40px_-24px_rgba(31,26,20,0.45)]"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-xl text-ink">Menu</p>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-muted"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {signedIn && name ? (
          <p className="mt-1 truncate text-sm text-ink-soft">{name}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-1">
          {signedIn ? (
            appLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(
                  pathname === item.href || pathname.startsWith(`${item.href}/`),
                )}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))
          ) : (
            <>
              <Link href="/login" className={linkClass(pathname === "/login")}>
                Sign in
              </Link>
              <Link href="/signup" className={linkClass(pathname === "/signup")}>
                Create account
              </Link>
            </>
          )}
        </div>

        {signedIn ? (
          <section className="mt-8">
            <h2 className="px-3 text-xs font-medium tracking-wide text-ink-soft uppercase">
              Events
            </h2>
            {years.length === 0 ? (
              <p className="mt-2 px-3 text-sm text-ink-soft">
                Tag a memory with Christmas, a birthday, or another occasion and
                it will show up under that year.
              </p>
            ) : (
              years.map((group) => (
                <div key={group.year} className="mt-3">
                  <p className="px-3 text-sm font-medium text-ink">{group.year}</p>
                  <ul className="mt-1">
                    {group.events.map((event) => {
                      const current = samePlace(pathname, search, event.href);
                      return (
                        <li key={event.href}>
                          <Link
                            href={event.href}
                            className={linkClass(current)}
                            aria-current={current ? "page" : undefined}
                          >
                            {event.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </section>
        ) : null}

        {signedIn ? (
          <section className="mt-8">
            <h2 className="px-3 text-xs font-medium tracking-wide text-ink-soft uppercase">
              People
            </h2>
            {people.length === 0 ? (
              <p className="mt-2 px-3 text-sm text-ink-soft">
                Add family members under People, then tag them on a memory.
              </p>
            ) : (
              <ul className="mt-2">
                {people.map((person) => {
                  const current = samePlace(pathname, search, person.href);
                  return (
                    <li key={person.href}>
                      <Link
                        href={person.href}
                        className={linkClass(current)}
                        aria-current={current ? "page" : undefined}
                      >
                        {person.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {circleSlug ? (
          <section className="mt-8">
            <h2 className="px-3 text-xs font-medium tracking-wide text-ink-soft uppercase">
              {currentCircle?.name ?? "This circle"}
            </h2>
            <div className="mt-2 flex flex-col gap-1">
              {familyNavLinks.map((item) => {
                const href = `/families/${circleSlug}${item.suffix}`;
                const active =
                  item.suffix === ""
                    ? pathname === href
                    : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={linkClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {signedIn ? (
          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-3 px-3">
              <h2 className="text-xs font-medium tracking-wide text-ink-soft uppercase">
                Circles
              </h2>
              <Link
                href="/families/new"
                className="text-sm text-forest underline-offset-4 hover:underline"
              >
                New
              </Link>
            </div>
            {circles.length === 0 ? (
              <p className="mt-2 px-3 text-sm text-ink-soft">
                No circles yet. Start one, or accept an invite.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {circles.map((circle) => {
                  const href = `/families/${circle.slug}`;
                  const active =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <li key={circle.slug}>
                      <Link href={href} className={linkClass(active)}>
                        <span className="min-w-0 flex-1 truncate">
                          {circle.name}
                        </span>
                        <span className="shrink-0 text-xs tracking-wide text-ink-soft uppercase">
                          {circle.badge}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {signedIn ? (
          <form action={logoutAction} className="mt-8 px-3">
            <button
              type="submit"
              className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Sign out
            </button>
          </form>
        ) : null}
      </nav>
    </>
  ) : null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-muted"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="app-menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function samePlace(pathname: string, search: string, href: string) {
  const [path, query = ""] = href.split("?");
  if (pathname !== path) return false;
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(search);
  for (const [key, value] of want) {
    if (have.get(key) !== value) return false;
  }
  return true;
}

