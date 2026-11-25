"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileVideo, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useUIStore } from "@/stores/ui-store";
import { useProjects } from "@/lib/data/hooks";
import { ALL_NAV } from "./nav-items";
import { cn } from "@/lib/utils";
import { PROJECT_KIND_META } from "@/components/common/project-meta";

interface Result {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function QuickSearch() {
  const open = useUIStore((s) => s.searchOpen);
  const setOpen = useUIStore((s) => s.setSearch);
  const { data } = useProjects();
  const projects = useMemo(() => data ?? [], [data]);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUIStore.getState().searchOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: Result[] = ALL_NAV.map((n) => ({ id: n.href, label: n.label, hint: n.description, href: n.href, icon: n.icon }));
    const proj: Result[] = projects.map((p) => ({
      id: p.id,
      label: p.name,
      hint: PROJECT_KIND_META[p.kind].label,
      href: `${PROJECT_KIND_META[p.kind].href}?project=${p.id}`,
      icon: FileVideo,
    }));
    const all = [...pages, ...proj];
    if (!q) return all.slice(0, 9);
    return all.filter((r) => r.label.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q)).slice(0, 12);
  }, [query, projects]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    setOpen(false);
    setQuery("");
    router.push(r.href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent className="glass-strong gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Jump to a page or project</DialogDescription>
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                go(results[active]);
              }
            }}
            placeholder="Search pages and projects…"
            aria-label="Search pages and projects"
            role="combobox"
            aria-expanded
            aria-controls="quick-search-results"
            aria-activedescendant={results[active] ? `qs-${results[active].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            style={{ outline: "none" }}
          />
        </div>
        <ul id="quick-search-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No matches for “{query}”</li>}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <li
                key={r.id}
                id={`qs-${r.id}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  i === active ? "bg-violet/[0.14] text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 text-lavender" />
                <span className="truncate font-medium text-foreground">{r.label}</span>
                <span className="ml-auto truncate text-xs">{r.hint}</span>
                {i === active && <CornerDownLeft aria-hidden className="size-3.5 shrink-0" />}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
