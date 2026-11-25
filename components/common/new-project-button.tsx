"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

export function NewProjectButton({ size = "default" }: { size?: "default" | "lg" }) {
  const setNewProject = useUIStore((s) => s.setNewProject);
  return (
    <Button size={size} onClick={() => setNewProject(true)}>
      <Plus aria-hidden /> New project
    </Button>
  );
}
