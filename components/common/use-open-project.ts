"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Project } from "@/lib/types";

/**
 * Opens a project in the Video Editor or AI Video Clipper. Both pages load the project
 * (and its media from Supabase Storage) from the `project` query parameter.
 */
export function useOpenProject() {
  const router = useRouter();

  const openInEditor = (project: Pick<Project, "id">) => router.push(`/editor?project=${project.id}`);

  const openInClipper = (project: Pick<Project, "id" | "sourceAssetId" | "source">) => {
    if (!project.sourceAssetId && project.source?.type === "link") {
      toast.info("Upload the video file to clip it", {
        description: "Linked videos have no file in your storage yet. Import your own copy from the Video Downloader.",
      });
    }
    router.push(`/clipper?project=${project.id}`);
  };

  return { openInEditor, openInClipper };
}
