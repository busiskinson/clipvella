import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/common/page";
import { MusicStudio } from "@/components/music/music-studio";

export const metadata: Metadata = { title: "AI Music Studio" };

export default function MusicPage() {
  return (
    <PageContainer>
      <PageHeader
        title="AI Music Studio"
        description="Describe a mood, pick a genre and generate original background music for your videos."
      />
      <div role="note" className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/[0.07] p-4 text-sm">
        <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Frontend demonstration.</span> No AI music model is connected yet. “Generate” creates a
          history entry and the player auditions a procedural sketch built in your browser from the tempo and mood you chose.
        </p>
      </div>
      <MusicStudio />
    </PageContainer>
  );
}
