import type { Metadata } from "next";
import { DemoBadge, PageContainer, PageHeader } from "@/components/common/page";
import { SourceInput } from "@/components/clipper/source-input";
import { ClipSettings } from "@/components/clipper/clip-settings";
import { AnalysisPanel } from "@/components/clipper/analysis-panel";
import { ClipResults } from "@/components/clipper/clip-results";

export const metadata: Metadata = { title: "AI Video Clipper" };

export default function ClipperPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<DemoBadge title="Highlight detection, speaker tracking and transcription are simulated until the AI backend is connected." />}
        title="AI Video Clipper"
        description="Turn a long video into short, captioned clips. Pick a source, tune the settings, then generate."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-6">
          <SourceInput />
          <AnalysisPanel />
          <ClipResults />
        </div>
        <div className="min-w-0 xl:sticky xl:top-22 xl:self-start">
          <ClipSettings />
        </div>
      </div>
    </PageContainer>
  );
}
