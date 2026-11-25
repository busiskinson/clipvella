"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useProjects } from "@/lib/data/hooks";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";

export function RecentProjects() {
  const { data, loading, error } = useProjects();
  const recent = (data ?? []).slice(0, 4);

  return (
    <section aria-labelledby="recent-heading" className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 id="recent-heading" className="text-lg font-semibold">
          Recent projects
        </h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            View all <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      {loading ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="glass aspect-[4/3] animate-pulse rounded-2xl" />
          ))}
        </ul>
      ) : error ? (
        <p role="alert" className="glass rounded-2xl p-8 text-center text-sm text-destructive">Couldn&apos;t load projects: {error}</p>
      ) : recent.length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No projects yet. Create one to get started.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {recent.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
            >
              <ProjectCard project={p} />
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
