import { PageContainer } from "@/components/common/page";

/** Instant placeholder while the next page loads; the sidebar and top bar stay in place. */
export default function Loading() {
  return (
    <PageContainer aria-busy="true" aria-label="Loading page">
      <div className="mb-6 grid gap-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="glass h-72 animate-pulse rounded-2xl" />
        <div className="glass hidden h-72 animate-pulse rounded-2xl xl:block" />
      </div>
    </PageContainer>
  );
}
