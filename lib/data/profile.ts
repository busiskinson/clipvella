"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";
import { DEFAULT_SETTINGS, type Settings } from "@/stores/settings-store";

export interface LoadedProfile {
  userId: string;
  email: string;
  settings: Settings;
}

const COLUMN_KEYS = ["displayName", "workspace"] as const;

/** Reads the signed-in user's profile row and merges stored preferences over the defaults. */
export async function fetchProfile(): Promise<LoadedProfile | null> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
  if (error) throw error;
  const stored = (data.settings ?? {}) as Partial<Settings>;
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    settings: { ...DEFAULT_SETTINGS, ...stored, displayName: data.display_name, workspace: data.workspace },
  };
}

/** Persists settings: name/workspace to columns, everything else to profiles.settings (jsonb). */
export async function saveProfile(userId: string, settings: Settings): Promise<void> {
  const supabase = createClient();
  const prefs = Object.fromEntries(Object.entries(settings).filter(([k]) => !(COLUMN_KEYS as readonly string[]).includes(k)));
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: settings.displayName, workspace: settings.workspace, settings: prefs as Json })
    .eq("id", userId);
  if (error) throw error;
}

export async function signOut() {
  await createClient().auth.signOut();
}
