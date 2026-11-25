"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { NAV_CREATE, NAV_LIBRARY, isActive, type NavItem } from "./nav-items";
import { Logo } from "./logo";
import { SAMPLE_USAGE } from "@/lib/sample-data";

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200",
        active ? "text-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl border border-violet/30 bg-violet/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
      )}
      <Icon
        aria-hidden
        className={cn("relative size-[18px] shrink-0 transition-colors", active ? "text-lavender" : "group-hover:text-lavender/80")}
      />
      {!collapsed && <span className="relative truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { used, total } = SAMPLE_USAGE.credits;
  const pct = Math.round((used / total) * 100);

  return (
    <div className="flex h-full flex-col gap-6">
      <nav aria-label="Create" className="flex flex-col gap-1">
        {!collapsed && <p className="px-3 pb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/80">Create</p>}
        {NAV_CREATE.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
      <nav aria-label="Library" className="flex flex-col gap-1">
        {!collapsed && <p className="px-3 pb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/80">Library</p>}
        {NAV_LIBRARY.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      {!collapsed && (
        <div className="glass mt-auto rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden className="size-4 text-lavender" />
            Processing credits
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {used} of {total} min used · <span className="italic">sample data</span>
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-label="Credits used (sample data)"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-violet to-ice" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarNav() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 backdrop-blur-xl transition-[width] duration-300 lg:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className={cn("mb-8 flex items-center px-2", collapsed ? "justify-center" : "justify-between")}>
        <Logo collapsed={collapsed} />
      </div>
      <div className="min-h-0 flex-1">
        <SidebarContent collapsed={collapsed} />
      </div>
      <div className={cn("mt-4 flex", collapsed ? "justify-center" : "justify-end px-1")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
