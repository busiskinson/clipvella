"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Server } from "lucide-react";
import { CardHeader, GlassCard } from "@/components/common/page";
import { cn } from "@/lib/utils";

interface Status {
  metadata: boolean;
  facebookMetadata: boolean;
  mediaService: boolean;
}

function Row({ ok, title, detail }: { ok: boolean | null; title: string; detail: string }) {
  return (
    <li className="flex gap-3 py-2.5">
      {ok ? (
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <CircleDashed aria-hidden className={cn("mt-0.5 size-4 shrink-0", ok === null ? "text-muted-foreground" : "text-warning")} />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {title} <span className="sr-only">{ok ? "connected" : ok === null ? "checking" : "not connected"}</span>
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

/** Shows which parts of the downloader are live and which still need backend work. */
export function BackendStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/media/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Status) => alive && setStatus(s))
      .catch(() => alive && setStatus({ metadata: true, facebookMetadata: false, mediaService: false }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <GlassCard className="p-4 sm:p-5">
      <CardHeader icon={Server} title="Service status" description="What works today and what needs backend development." />
      <ul className="mt-2 divide-y divide-white/[0.06]">
        <Row ok={status ? status.metadata : null} title="Link check & public details" detail="YouTube and TikTok titles, authors and thumbnails via official oEmbed." />
        <Row ok={status ? status.facebookMetadata : null} title="Facebook Reels details" detail="Needs a Meta app token (META_OEMBED_ACCESS_TOKEN)." />
        <Row ok={status ? status.mediaService : null} title="Downloads, MP4/MP3 & quality" detail="Needs an authorized media service (MEDIA_SERVICE_URL). Also provides duration." />
        <Row ok={true} title="Local file import" detail="Runs in your browser. Files are kept for this session." />
      </ul>
    </GlassCard>
  );
}
