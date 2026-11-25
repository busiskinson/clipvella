"use client";

import { Captions, ScanFace, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardHeader, GlassCard } from "@/components/common/page";
import { Segmented, SliderField } from "@/components/common/fields";
import { AspectPicker } from "@/components/common/aspect-picker";
import { useClipperStore, type ClipLength } from "@/stores/clipper-store";
import { CAPTION_TEMPLATES } from "@/lib/sample-data";

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "auto", label: "Detect automatically" },
];

function SettingRow({ id, title, description, checked, onChange }: { id: string; title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ClipSettings({
  onGenerate,
  busy,
  canGenerate,
  hasClips,
  disabledReason,
}: {
  onGenerate: () => void;
  busy: boolean;
  canGenerate: boolean;
  hasClips: boolean;
  disabledReason: string;
}) {
  const s = useClipperStore();

  return (
    <GlassCard className="flex flex-col gap-6 p-5 sm:p-6">
      <CardHeader icon={SlidersHorizontal} title="Clip settings" description="Applied when you generate clips." />

      <div className="grid gap-2">
        <span className="text-sm font-medium">Clip length</span>
        <Segmented<ClipLength>
          label="Clip length"
          value={s.clipLength}
          onChange={(clipLength) => s.set({ clipLength })}
          size="sm"
          options={[
            { value: "auto", label: "Auto" },
            { value: "15-30", label: "15–30s" },
            { value: "30-60", label: "30–60s" },
            { value: "60-90", label: "60–90s" },
          ]}
        />
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Aspect ratio</span>
        <AspectPicker value={s.aspect} onChange={(aspect) => s.set({ aspect })} />
      </div>

      <SliderField label="Number of clips" value={s.clipCount} min={3} max={12} onChange={(clipCount) => s.set({ clipCount })} />

      <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
        <ScanFace aria-hidden className="mt-0.5 size-4 shrink-0 text-lavender" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Framing:</span> each clip is centre-cropped to {s.aspect}. Following the speaker&apos;s face
          is planned for a later version.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Captions aria-hidden className="size-4 text-lavender" /> Subtitles
        </div>
        <SettingRow
          id="auto-subs"
          title="Generate subtitles automatically"
          description="Transcribe speech and burn in styled captions."
          checked={s.autoSubtitles}
          onChange={(autoSubtitles) => s.set({ autoSubtitles })}
        />
        {s.autoSubtitles && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sub-lang" className="text-xs text-muted-foreground">
                Language
              </Label>
              <Select value={s.subtitleLanguage} onValueChange={(subtitleLanguage) => s.set({ subtitleLanguage })}>
                <SelectTrigger id="sub-lang" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-style" className="text-xs text-muted-foreground">
                Caption style
              </Label>
              <Select value={s.subtitleTemplate} onValueChange={(subtitleTemplate) => s.set({ subtitleTemplate })}>
                <SelectTrigger id="sub-style" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPTION_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <Button size="lg" onClick={onGenerate} disabled={!canGenerate || busy}>
        <Sparkles aria-hidden /> {busy ? "Working…" : hasClips ? "Regenerate clips" : "Generate clips"}
      </Button>
      {!canGenerate && <p className="-mt-3 text-center text-xs text-muted-foreground">{disabledReason}</p>}
    </GlassCard>
  );
}
