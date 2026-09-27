"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";

import { logoutAction } from "@/lib/actions/auth";
import { familyNavLinks } from "@/components/family-subnav";
import { cn } from "@/lib/utils";

export type MenuCircle = {
  name: string;
  slug: string;
  badge: string;
};

export type MenuShortcut = {
  href: string;
  title: string;
  detail: string;
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
  events,
  people,
}: {
  signedIn: boolean;
  name?: string | null;
  circles: MenuCircle[];
  events: MenuShortcut[];
  people: MenuShortcut[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          <ShortcutList
            title="Events"
            empty="Tag a memory with Christmas, a birthday, or another occasion and it will show up here."
            items={events}
            isCurrent={(href) => samePlace(pathname, searchParams, href)}
          />
        ) : null}

        {signedIn ? (
          <ShortcutList
            title="People"
            empty="Tag someone on a memory to open just their timeline."
            items={people}
            isCurrent={(href) => samePlace(pathname, searchParams, href)}
          />
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

function samePlace(
  pathname: string,
  searchParams: { get: (key: string) => string | null },
  href: string,
) {
  const [path, query = ""] = href.split("?");
  if (pathname !== path) return false;
  const want = new URLSearchParams(query);
  for (const [key, value] of want) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

function ShortcutList({
  title,
  empty,
  items,
  isCurrent,
}: {
  title: string;
  empty: string;
  items: MenuShortcut[];
  isCurrent: (href: string) => boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="px-3 text-xs font-medium tracking-wide text-ink-soft uppercase">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 px-3 text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((item) => {
            const current = isCurrent(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={linkClass(current)}
                  aria-current={current ? "page" : undefined}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.title}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {item.detail}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
