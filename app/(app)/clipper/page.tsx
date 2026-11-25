import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/common/page";
import { ClipperWorkspace } from "@/components/clipper/clipper-workspace";

export const metadata: Metadata = { title: "AI Video Clipper" };

export default function ClipperPage() {
  return (
    <PageContainer>
      <PageHeader
        title="AI Video Clipper"
        description="Upload a video and the AI transcribes it with Whisper, finds the strongest moments with Gemini, and renders them as short clips with FFmpeg."
      />
      {/* useSearchParams needs a Suspense boundary under cacheComponents */}
      <Suspense fallback={<div className="glass h-64 animate-pulse rounded-2xl" />}>
        <ClipperWorkspace />
      </Suspense>
    </PageContainer>
  );
}
