import { Captions, Clapperboard, Download, Scissors, type LucideIcon } from "lucide-react";
import type { ProjectKind, ProjectStatus } from "@/lib/types";

export const PROJECT_KIND_META: Record<ProjectKind, { label: string; href: string; icon: LucideIcon }> = {
  clip: { label: "AI Clips", href: "/clipper", icon: Scissors },
  edit: { label: "Video edit", href: "/editor", icon: Clapperboard },
  captions: { label: "Captions", href: "/captions", icon: Captions },
  import: { label: "Imported video", href: "/downloader", icon: Download },
};

export const STATUS_META: Record<ProjectStatus, { label: string; className: string }> = {
  ready: { label: "Ready", className: "border-success/30 bg-success/10 text-success" },
  draft: { label: "Draft", className: "border-white/15 bg-white/[0.06] text-muted-foreground" },
  processing: { label: "Processing", className: "border-ice/30 bg-ice/10 text-ice" },
};
