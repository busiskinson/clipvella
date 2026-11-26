"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Plus, Search, Settings, FolderKanban, LogOut } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/data/profile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUIStore } from "@/stores/ui-store";
import { useSettingsStore } from "@/stores/settings-store";
import { ALL_NAV, isActive } from "./nav-items";
import { Logo } from "./logo";
import { SidebarContent } from "./sidebar-nav";

export function Topbar() {
  const pathname = usePathname();
  const current = ALL_NAV.find((n) => isActive(pathname, n.href));
  const setSearch = useUIStore((s) => s.setSearch);
  const setNewProject = useUIStore((s) => s.setNewProject);
  const mobileOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobile = useUIStore((s) => s.setMobileNav);
  const displayName = useSettingsStore((s) => s.displayName);
  const email = useSettingsStore((s) => s.email);
  const workspace = useSettingsStore((s) => s.workspace);
  const router = useRouter();
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-midnight/70 px-3 backdrop-blur-xl sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobile(true)}>
        <Menu aria-hidden />
      </Button>
      <div className="lg:hidden">
        <Logo collapsed />
      </div>
      <p className="hidden truncate font-heading text-[15px] font-medium text-muted-foreground lg:block">
        {current?.label ?? "Clipvella"}
      </p>

      <button
        type="button"
        onClick={() => setSearch(true)}
        className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-muted-foreground transition-colors duration-200 hover:border-white/15 hover:bg-white/[0.05] sm:w-full sm:max-w-sm sm:shrink sm:justify-start"
        aria-label="Search pages and projects"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search pages and projects</span>
        <kbd className="ml-auto hidden rounded-md border border-white/10 px-1.5 py-0.5 font-sans text-[11px] sm:inline">Ctrl K</kbd>
      </button>

      <Button onClick={() => setNewProject(true)} className="shrink-0">
        <Plus aria-hidden />
        <span className="hidden sm:inline">New project</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-violet/40 to-ice/30 text-sm font-semibold transition-colors hover:border-lavender/50"
          >
            {initials || "C"}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email || workspace}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/projects">
              <FolderKanban aria-hidden /> My projects
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings aria-hidden /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await signOut();
                router.replace("/login");
                router.refresh();
              } catch {
                toast.error("Couldn't sign out. Try again.");
              }
            }}
          >
            <LogOut aria-hidden /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mobileOpen} onOpenChange={setMobile}>
        <DialogContent className="glass-strong top-0 left-0 h-dvh max-w-[300px] translate-x-0 translate-y-0 rounded-none rounded-r-2xl p-5 sm:max-w-[300px]">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="mb-6">
            <Logo />
          </div>
          <SidebarContent onNavigate={() => setMobile(false)} />
        </DialogContent>
      </Dialog>
    </header>
  );
}
