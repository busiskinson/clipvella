"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/page";
import { captionFontVariables } from "@/lib/caption-fonts";
import { CaptionPreview } from "./caption-preview";
import { CaptionList } from "./caption-list";
import { StylePanel } from "./style-panel";

export function CaptionStudio() {
  const [time, setTime] = useState(0);

  return (
    <div
      className={`grid gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)_minmax(0,1fr)] ${captionFontVariables}`}
    >
      <GlassCard className="flex flex-col items-center gap-4 p-5 lg:sticky lg:top-22 lg:self-start">
        <CaptionPreview time={time} setTime={setTime} />
        <Button variant="glass" size="sm" asChild>
          <Link href="/editor">
            <Clapperboard aria-hidden /> Use these captions in the editor
          </Link>
        </Button>
      </GlassCard>
      {/* stacked on lg/xl, separate columns on 2xl */}
      <div className="grid min-w-0 content-start gap-6 2xl:contents">
        <div className="min-w-0 2xl:order-3 2xl:sticky 2xl:top-22 2xl:self-start">
          <StylePanel />
        </div>
        <div className="min-w-0 2xl:order-2">
          <CaptionList time={time} setTime={setTime} />
        </div>
      </div>
    </div>
  );
}
