"use client";

import { useId } from "react";
import { ClipboardPaste, Download, Link2, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseVideoLink } from "@/lib/platforms";
import type { SupportedPlatform } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PlatformChip } from "./shared";

const PLATFORMS: SupportedPlatform[] = ["tiktok", "youtube", "facebook"];

export function UrlBar({
  value,
  onChange,
  onSubmit,
  busy,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const id = useId();
  const parsed = value.trim() ? parseVideoLink(value) : null;
  const detected = parsed?.ok ? parsed.platform : null;
  // Live hint only once the user has typed something that looks like a link
  const liveHint = parsed && !parsed.ok && value.trim().length > 8 ? parsed.message : null;
  const message = error ?? liveHint;

  const paste = async () => {
    if (!navigator.clipboard?.readText) {
      toast.error("Clipboard access isn't available here", { description: "Click the field and press Ctrl+V (⌘V on Mac)." });
      return;
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast.info("Your clipboard is empty", { description: "Copy a TikTok, YouTube or Facebook Reels link first." });
        return;
      }
      onChange(text);
      if (parseVideoLink(text).ok) onSubmit(text);
    } catch {
      toast.error("Clipboard access was blocked", { description: "Allow clipboard access, or click the field and press Ctrl+V." });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      noValidate
      className="grid gap-3"
    >
      <label htmlFor={id} className="sr-only">
        Video link
      </label>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-2xl border bg-black/30 p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition-colors duration-200 focus-within:border-violet/60 sm:flex-row sm:items-center",
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
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste a TikTok, YouTube or Facebook Reels link"
            aria-invalid={!!message}
            aria-describedby={`${id}-msg`}
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/80"
            style={{ outline: "none" }}
          />
          {value && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear link" onClick={() => onChange("")}>
              <X aria-hidden />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="glass" size="lg" onClick={paste} disabled={busy}>
            <ClipboardPaste aria-hidden /> Paste link
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Download aria-hidden />}
            {busy ? "Analyzing…" : "Download"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Supported platforms">
          {PLATFORMS.map((p) => (
            <PlatformChip key={p} platform={p} active={detected === p} />
          ))}
          <span className="sr-only" aria-live="polite">
            {detected ? `Detected ${detected}` : ""}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3.5 text-ice" /> Public videos you own or may use · no private or DRM content
        </p>
      </div>
      <p id={`${id}-msg`} role={error ? "alert" : undefined} className={cn("min-h-5 text-sm", message ? "text-destructive" : "sr-only")}>
        {message ?? "Paste a link and press Download."}
      </p>
    </form>
  );
}
