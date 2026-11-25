"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useSettingsStore } from "@/stores/settings-store";
import { useDownloaderStore } from "@/stores/downloader-store";

/** Rehydrate persisted stores after mount so server and client first render match. */
function StoreHydrator() {
  useEffect(() => {
    void useDownloaderStore.persist.rehydrate();
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <TooltipProvider delayDuration={300}>
        <StoreHydrator />
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </TooltipProvider>
    </MotionConfig>
  );
}
