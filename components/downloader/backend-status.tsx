"use client";

import { CheckCircle2, CircleDashed, Server } from "lucide-react";
import { CardHeader, GlassCard } from "@/components/common/page";

function Row({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <li className="flex gap-3 py-2.5">
      {ok ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />}
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {title} <span className="sr-only">{ok ? "available" : "not available"}</span>
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

/** What the downloader can do today, and what needs more setup. */
export function BackendStatus() {
  return (
    <GlassCard className="p-4 sm:p-5">
      <CardHeader icon={Server} title="What works" description="Imports go to your private Supabase storage." />
      <ul className="mt-2 divide-y divide-white/[0.06]">
        <Row ok title="Link check & public details" detail="YouTube and TikTok titles, authors and thumbnails via official oEmbed (Supabase Edge Function)." />
        <Row ok title="File import" detail="Your own video uploads to Supabase Storage and becomes a project you can clip and edit." />
        <Row ok={false} title="Facebook Reels details" detail="Optional: add the META_OEMBED_ACCESS_TOKEN secret to the resolve-link Edge Function." />
        <Row ok={false} title="Downloading from links" detail="Not available: these platforms offer no authorized download API for other people's videos." />
      </ul>
    </GlassCard>
  );
}
