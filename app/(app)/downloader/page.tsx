import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page";
import { DownloaderView } from "@/components/downloader/downloader-view";

export const metadata: Metadata = { title: "Video Downloader" };

export default function DownloaderPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Video Downloader"
        description="Import videos from TikTok, YouTube and Facebook Reels links, or from your own files, and send them to the Editor or Clipper."
      />
      <DownloaderView />
    </PageContainer>
  );
}
