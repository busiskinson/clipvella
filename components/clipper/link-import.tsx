"use client";

import { useId, useState } from "react";
import { ClipboardPaste, Link2, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlatformChip } from "@/components/downloader/shared";
import { parseVideoLink } from "@/lib/platforms";
import type { SupportedPlatform } from "@/lib/types";
import { cn } from "@/lib/utils";

const PLATFORMS: SupportedPlatform[] = ["tiktok", "youtube", "facebook"];

/**
 * Paste a TikTok / YouTube / Facebook link. The worker downloads the public video (yt-dlp) once the user confirms
 * they own it or have permission; the same checks run again on the server and the worker.
 */
export function LinkImport({
  onImport,
  busy,
  initialUrl = "",
  maxMinutes = 10,
}: {
  onImport: (url: string) => Promise<void>;
  busy: boolean;
  initialUrl?: string;
  maxMinutes?: number;
}) {
  const id = useId();
  const [value, setValue] = useState(initialUrl);
  const [rights, setRights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = value.trim() ? parseVideoLink(value) : null;
  const detected = parsed?.ok ? parsed.platform : null;
  const hint = parsed && !parsed.ok && value.trim().length > 8 ? parsed.message : null;
  const message = error ?? hint;

  const submit = async () => {
    const check = parseVideoLink(value);
    if (!check.ok) return setError(check.message);
    if (!rights) return setError("Confirm that you own this video or have permission to use it.");
    setError(null);
    await onImport(check.url);
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return toast.info("Your clipboard is empty", { description: "Copy a TikTok, YouTube or Facebook link first." });
      setValue(text);
      setError(null);
    } catch {
      toast.error("Clipboard access was blocked", { description: "Click the field and press Ctrl+V instead." });
    }
  };

  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        Video link
      </label>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-2xl border bg-black/30 p-2 transition-colors duration-200 focus-within:border-violet/60 sm:flex-row sm:items-center",
          message ? "border-destructive/50" : "border-white/10",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
          <Link2 aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <input
            id={id}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            disabled={busy}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="https://www.tiktok.com/@you/video/…"
            aria-invalid={!!message}
            aria-describedby={`${id}-msg`}
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          />
          {value && !busy && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear link" onClick={() => setValue("")}>
              <X aria-hidden />
            </Button>
          )}
        </div>
        <Button type="button" variant="glass" onClick={() => void paste()} disabled={busy}>
          <ClipboardPaste aria-hidden /> Paste
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Supported platforms">
        {PLATFORMS.map((p) => (
          <PlatformChip key={p} platform={p} active={detected === p} />
        ))}
        <span className="sr-only" aria-live="polite">
          {detected ? `Detected ${detected}` : ""}
        </span>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-sm">
        <input
          type="checkbox"
          checked={rights}
          disabled={busy}
          onChange={(e) => {
            setRights(e.target.checked);
            setError(null);
          }}
          className="mt-0.5 size-4 shrink-0 accent-violet"
        />
        <span>
          I own this video or have permission to use it <span className="text-muted-foreground">(required)</span>
        </span>
      </label>

      <p id={`${id}-msg`} role={error ? "alert" : undefined} className={cn("text-sm", message ? "text-destructive" : "sr-only")}>
        {message ?? "Paste a link, confirm you may use it, then import."}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-ice" /> Public videos up to {maxMinutes} minutes. Private, live, paid or DRM-protected videos
          are refused.
        </p>
        <Button type="submit" disabled={busy || !value.trim()}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Link2 aria-hidden />}
          {busy ? "Importing…" : "Import video"}
        </Button>
      </div>
    </form>
  );
}
