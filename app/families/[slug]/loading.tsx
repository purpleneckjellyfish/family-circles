import { FeedSkeleton, PageHeaderSkeleton } from "@/components/ui-states";
import { SiteHeader } from "@/components/site-header";

export default function FamilyLoading() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-4 sm:px-10">
        <PageHeaderSkeleton />
        <div className="mt-10">
          <FeedSkeleton count={2} />
        </div>
      </main>
    </div>
  );
}
