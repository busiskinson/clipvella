"use client";

import { MotionConfig } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useSettingsStore } from "@/stores/settings-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </TooltipProvider>
    </MotionConfig>
  );
}
