import Link from "next/link";
import { and, eq } from "drizzle-orm";

import { AppMenu, type MenuCircle } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import { families, familyMemberships, follows, getDb } from "@/db";
import { getSessionUser } from "@/lib/session";

async function loadMenuCircles(userId: string): Promise<MenuCircle[]> {
  const db = getDb();
  const memberships = await db
    .select({
      name: families.name,
      slug: families.slug,
      role: familyMemberships.role,
      canPost: familyMemberships.canPost,
    })
    .from(familyMemberships)
    .innerJoin(families, eq(families.id, familyMemberships.familyId))
    .where(eq(familyMemberships.userId, userId));

  const following = await db
    .select({
      name: families.name,
      slug: families.slug,
    })
    .from(follows)
    .innerJoin(families, eq(families.id, follows.familyId))
    .where(and(eq(follows.followerUserId, userId), eq(follows.status, "accepted")));

  const memberSlugs = new Set(memberships.map((row) => row.slug));
  const memberCircles = memberships.map((row) => ({
    name: row.name,
    slug: row.slug,
    badge:
      row.role === "follower" ? (row.canPost ? "can post" : "follower") : row.role,
  }));
  const followed = following
    .filter((row) => !memberSlugs.has(row.slug))
    .map((row) => ({
      name: row.name,
      slug: row.slug,
      badge: "following",
    }));

  return [...memberCircles, ...followed];
}

export async function SiteHeader() {
  const user = await getSessionUser();
  const circles = user?.id ? await loadMenuCircles(user.id) : [];

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-10 md:py-5">
        <Link
          href={user ? "/home" : "/"}
          className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
        >
          Family Circles
        </Link>
        {user ? (
          <>
            <nav className="hidden items-center gap-2 md:flex">
              <span className="text-sm text-ink-soft">{user.name ?? user.email}</span>
              <Button variant="ghost" render={<Link href="/home" />}>
                Home
              </Button>
              <Button variant="ghost" render={<Link href="/throwbacks" />}>
                Throwbacks
              </Button>
              <Button variant="ghost" render={<Link href="/settings" />}>
                Settings
              </Button>
            </nav>
            <AppMenu
              signedIn
              name={user.name ?? user.email}
              circles={circles}
            />
          </>
        ) : (
          <>
            <nav className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" render={<Link href="/login" />}>
                Sign in
              </Button>
              <Button render={<Link href="/signup" />}>Create account</Button>
            </nav>
            <AppMenu signedIn={false} circles={[]} />
          </>
        )}
      </div>
    </header>
  );
}
