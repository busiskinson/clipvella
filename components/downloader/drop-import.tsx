"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardHeader, GlassCard } from "@/components/common/page";
import { cn } from "@/lib/utils";

const MAX_BYTES = 4 * 1024 * 1024 * 1024;

/** Alternative to links: drop or browse for a local video. Dropped links are analyzed too. */
export function DropImport({ onFile, onLink, busy }: { onFile: (file: File) => void; onLink: (url: string) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError(`“${file.name}” isn't a video. Use MP4, MOV or WebM.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Files up to 4 GB are supported.");
      return;
    }
    setError(null);
    onFile(file);
  };

  return (
    <GlassCard className="p-4 sm:p-5">
      <CardHeader icon={UploadCloud} title="Or import a file" description="Already have the video? Drop it here — it never leaves your device." />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) return accept(file);
          const link = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")).split("\n")[0]?.trim();
          if (link) onLink(link);
        }}
        className={cn(
          "mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors duration-200",
          dragging ? "border-violet/70 bg-violet/[0.08]" : "border-white/15 bg-white/[0.015]",
        )}
      >
        <p className="text-sm">
          <span className="font-medium">Drag and drop a video or a link</span>
          <span className="block text-muted-foreground">MP4, MOV or WebM up to 4 GB</span>
        </p>
        <Button variant="glass" onClick={() => input.current?.click()} disabled={busy}>
          Browse files
        </Button>
        <input
          ref={input}
          type="file"
          accept="video/*"
          className="sr-only"
          aria-label="Choose a video file to import"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
