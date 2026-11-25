import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/common/page";

export default function NotFound() {
  return (
    <PageContainer className="grid flex-1 place-items-center">
      <div className="glass max-w-md rounded-3xl p-10 text-center">
        <p className="font-heading text-5xl font-semibold text-gradient">404</p>
        <h1 className="mt-3 text-xl font-semibold">This page is not on the timeline</h1>
        <p className="mt-2 text-sm text-muted-foreground">The link may be broken or the page was moved.</p>
        <Button asChild className="mt-6">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
