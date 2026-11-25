import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/common/page";
import { CaptionStudio } from "@/components/captions/caption-studio";

export const metadata: Metadata = { title: "Caption Studio" };

export default function CaptionsPage() {
  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader
        title="Caption Studio"
        description="Generate subtitles from speech with Whisper, edit text and timing, and style karaoke highlights, fonts and animations with a live preview. Changes save to your project."
      />
      <Suspense fallback={<div className="glass h-64 animate-pulse rounded-2xl" />}>
        <CaptionStudio />
      </Suspense>
    </PageContainer>
  );
}
