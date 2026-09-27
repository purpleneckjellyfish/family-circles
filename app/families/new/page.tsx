import { SiteHeader } from "@/components/site-header";
import { CreateFamilyForm } from "@/components/family-forms";
import { requireUser } from "@/lib/session";

export const metadata = { title: "New circle" };

export default async function NewFamilyPage() {
  await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <h1 className="font-display text-4xl font-semibold text-ink">
          Create a family circle
        </h1>
        <p className="mt-3 max-w-md text-ink-soft">
          You become the owner. Add adults and kids to the roster, then invite
          adults with a link or email. Followers stay quiet until you grant photo
          posting.
        </p>
        <div className="mt-8">
          <CreateFamilyForm />
        </div>
      </main>
    </div>
  );
}
