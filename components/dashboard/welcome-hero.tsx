"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Download, Plus, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settings-store";
import { useUIStore } from "@/stores/ui-store";

export function WelcomeHero() {
  const name = useSettingsStore((s) => s.displayName);
  const setNewProject = useUIStore((s) => s.setNewProject);

  return (
    <section className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10">
      {/* soft light source behind the glass */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-violet/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-ice/10 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
          <p className="text-sm font-medium text-lavender">Welcome back, {name}</p>
          <h1 className="mt-2 text-3xl font-semibold text-balance sm:text-4xl">
            Turn long videos into <span className="text-gradient">scroll-stopping shorts</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-muted-foreground text-pretty">
            Import a video, clip its highlights, polish them on a multitrack timeline and add animated captions, all in
            one workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => setNewProject(true)}>
              <Plus aria-hidden /> New project
            </Button>
            <Button size="lg" variant="glass" asChild>
              <Link href="/projects">
                View projects <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ShortcutCard
            href="/clipper"
            icon={Scissors}
            title="AI Video Clipper"
            body="Upload or paste a link and preview highlight detection."
            accent="violet"
          />
          <ShortcutCard
            href="/downloader"
            icon={Download}
            title="Video Downloader"
            body="Paste a TikTok, YouTube or Reels link, or drop in a file."
            accent="ice"
          />
        </div>
      </div>
    </section>
  );
}

function ShortcutCard({
  href,
  icon: Icon,
  title,
  body,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  accent: "violet" | "ice";
}) {
  return (
    <Link
      href={href}
      className="glass glow-hover group flex items-center gap-4 rounded-2xl p-4 hover:-translate-y-0.5"
    >
      <span
        className={
          accent === "violet"
            ? "grid size-11 shrink-0 place-items-center rounded-xl bg-violet/15 text-lavender ring-1 ring-violet/25"
            : "grid size-11 shrink-0 place-items-center rounded-xl bg-ice/10 text-ice ring-1 ring-ice/25"
        }
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
      </span>
      <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
