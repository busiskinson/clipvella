import {
  Captions,
  Clapperboard,
  Download,
  FolderKanban,
  LayoutDashboard,
  Scissors,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_CREATE: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Overview and shortcuts", icon: LayoutDashboard },
  { href: "/clipper", label: "AI Video Clipper", description: "Turn long videos into shorts", icon: Scissors },
  { href: "/editor", label: "Video Editor", description: "Multitrack timeline editing", icon: Clapperboard },
  { href: "/captions", label: "Caption Studio", description: "Style animated subtitles", icon: Captions },
  { href: "/downloader", label: "Video Downloader", description: "Import videos from links or files", icon: Download },
];

export const NAV_LIBRARY: NavItem[] = [
  { href: "/projects", label: "My Projects", description: "Everything you have made", icon: FolderKanban },
  { href: "/settings", label: "Settings", description: "Workspace and defaults", icon: Settings },
];

export const ALL_NAV = [...NAV_CREATE, ...NAV_LIBRARY];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
