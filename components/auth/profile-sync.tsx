"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { fetchProfile } from "@/lib/data/profile";
import { useSettingsStore } from "@/stores/settings-store";

/** Loads the signed-in user's profile into the settings store once per app session. */
export function ProfileSync() {
  useEffect(() => {
    let alive = true;
    fetchProfile()
      .then((p) => {
        if (alive && p) useSettingsStore.getState().hydrate(p.userId, p.email, p.settings);
      })
      .catch((e) => toast.error("Couldn't load your profile", { description: e instanceof Error ? e.message : undefined }));
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
