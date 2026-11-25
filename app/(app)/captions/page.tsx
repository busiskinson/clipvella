import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page";
import { CaptionStudio } from "@/components/captions/caption-studio";

export const metadata: Metadata = { title: "Caption Studio" };

export default function CaptionsPage() {
  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader
        title="Caption Studio"
        description="Edit subtitle text and timing, then style karaoke highlights, fonts and animations with a live preview. Captions are shared with the Video Editor."
      />
      <CaptionStudio />
    </PageContainer>
  );
}
