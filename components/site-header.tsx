import Link from "next/link";

import { logoutAction } from "@/lib/actions/auth";
import { getSessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
      <Link
        href={user ? "/home" : "/"}
        className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
      >
        Family Circles
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        {user ? (
          <>
            <span className="hidden text-sm text-ink-soft sm:inline">
              {user.name ?? user.email}
            </span>
            <Button variant="ghost" render={<Link href="/home" />}>
              Home
            </Button>
            <Button variant="ghost" render={<Link href="/throwbacks" />}>
              Throwbacks
            </Button>
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          <>
            <Button variant="ghost" render={<Link href="/login" />}>
              Sign in
            </Button>
            <Button render={<Link href="/signup" />}>Create account</Button>
          </>
        )}
      </nav>
    </header>
  );
}
