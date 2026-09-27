import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/lib/actions/families";
import { families, getDb, invites } from "@/db";
import { getSessionUser } from "@/lib/session";

export const metadata = { title: "Invite" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const user = await getSessionUser();

  const [invite] = await db
    .select({
      id: invites.id,
      role: invites.role,
      acceptedAt: invites.acceptedAt,
      expiresAt: invites.expiresAt,
      familyName: families.name,
      familySlug: families.slug,
    })
    .from(invites)
    .innerJoin(families, eq(families.id, invites.familyId))
    .where(eq(invites.token, token))
    .limit(1);

  if (!invite) notFound();

  const expired =
    invite.expiresAt != null && invite.expiresAt.getTime() < new Date().getTime();
  const used = Boolean(invite.acceptedAt);
  const roleLabel =
    invite.role === "follower" ? "collaborator (follower)" : "family member (adult)";

  async function accept() {
    "use server";
    await acceptInviteAction(token);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-16">
        <h1 className="font-display text-4xl font-semibold text-ink">
          You&apos;re invited
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Join <span className="text-ink">{invite.familyName}</span> as a{" "}
          {roleLabel}.
        </p>

        {used || expired ? (
          <p className="mt-6 text-sm text-destructive" role="alert">
            {used ? "This invite was already used." : "This invite has expired."}
          </p>
        ) : user ? (
          <form action={accept} className="mt-8">
            <Button type="submit" size="lg">
              Accept invite
            </Button>
          </form>
        ) : (
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              render={
                <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} />
              }
            >
              Sign in to accept
            </Button>
            <Button
              variant="outline"
              render={
                <Link href={`/signup?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} />
              }
            >
              Create account
            </Button>
          </div>
        )}

        {!used && !expired ? (
          <p className="mt-6 text-sm text-ink-soft">
            After joining you can open{" "}
            <Link
              href={`/families/${invite.familySlug}`}
              className="text-forest underline-offset-4 hover:underline"
            >
              {invite.familyName}
            </Link>
            .
          </p>
        ) : null}
      </main>
    </div>
  );
}
