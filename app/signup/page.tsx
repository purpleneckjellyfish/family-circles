import { SiteHeader } from "@/components/site-header";
import { SignUpForm } from "@/components/auth-forms";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const user = await getSessionUser();
  const { callbackUrl } = await searchParams;
  if (user) redirect(callbackUrl?.startsWith("/") ? callbackUrl : "/home");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <h1 className="font-display text-4xl font-semibold text-ink">Join Family Circles</h1>
        <p className="mt-3 text-ink-soft">
          Create an account on this instance, then start or join a family circle.
        </p>
        <div className="mt-8">
          <SignUpForm callbackUrl={callbackUrl} />
        </div>
      </main>
    </div>
  );
}
