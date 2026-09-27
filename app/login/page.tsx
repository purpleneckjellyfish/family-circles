import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/auth-forms";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
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
        <h1 className="font-display text-4xl font-semibold text-ink">Welcome back</h1>
        <p className="mt-3 text-ink-soft">Sign in to your Family Circles account.</p>
        <div className="mt-8">
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </main>
    </div>
  );
}
