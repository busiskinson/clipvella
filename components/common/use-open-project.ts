"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MediaItem, Project } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/platforms";
import { useEditorStore } from "@/stores/editor-store";
import { useClipperStore } from "@/stores/clipper-store";
import { useMediaRegistry } from "@/stores/media-registry";

/** Opens an imported project in the Video Editor or AI Video Clipper. */
export function useOpenProject() {
  const router = useRouter();

  const localFileFor = (project: Project) => useMediaRegistry.getState().files[project.id];

  /** Local files are session-only; after a reload they have to be re-imported. */
  const missingFile = (project: Project) => {
    if (project.source?.type !== "file" || localFileFor(project)) return false;
    toast.error("Re-import this file to open it", {
      description: "Local files stay on your device and are only kept for the current browser session.",
      action: { label: "Video Downloader", onClick: () => router.push("/downloader") },
    });
    return true;
  };

  const openInEditor = (project: Project) => {
    if (!project.source) {
      router.push("/editor");
      return;
    }
    if (missingFile(project)) return;
    const file = localFileFor(project);
    const media: MediaItem = file
      ? { id: `media-${project.id}`, name: file.name, kind: "video", duration: file.duration, url: file.url, hue: project.hue, thumbnailUrl: project.source.thumbnail }
      : {
          id: `media-${project.id}`,
          name: project.name,
          kind: "video",
          duration: project.duration,
          hue: project.hue,
          thumbnailUrl: project.source.thumbnail,
          remote: true,
        };
    useEditorStore.getState().openImport({ projectName: project.name, aspect: project.aspect, media });
    if (media.remote) {
      toast.info("Opened as a linked video", { description: "Its file hasn't been downloaded, so the preview shows the thumbnail only." });
    }
    router.push("/editor");
  };

  const openInClipper = (project: Project) => {
    if (!project.source) {
      router.push("/clipper");
      return;
    }
    if (missingFile(project)) return;
    const file = localFileFor(project);
    const setSource = useClipperStore.getState().setSource;
    if (file) {
      setSource({ kind: "file", name: file.name, url: file.url, size: file.size, duration: file.duration });
    } else {
      setSource({
        kind: "url",
        name: project.name,
        url: project.source.url ?? "",
        duration: project.duration,
        platform: project.source.platform ? PLATFORM_LABEL[project.source.platform] : undefined,
        thumbnail: project.source.thumbnail,
      });
    }
    router.push("/clipper");
  };

  return { openInEditor, openInClipper };
}
