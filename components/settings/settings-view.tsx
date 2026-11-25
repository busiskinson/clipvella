"use client";

import { useState } from "react";
import { Accessibility, Bell, Database, Plug, SlidersHorizontal, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardHeader, GlassCard } from "@/components/common/page";
import { AspectPicker } from "@/components/common/aspect-picker";
import { useSettingsStore, type Settings } from "@/stores/settings-store";
import { LANGUAGES } from "@/components/clipper/clip-settings";

function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function TextSetting({ id, label, value, onSave }: { id: string; label: string; value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const v = draft.trim();
    if (v.length < 2) {
      setError(`${label} must be at least 2 characters.`);
      return;
    }
    setError(null);
    if (v !== value) {
      onSave(v);
      toast.success(`${label} updated`);
    }
  };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className="h-10"
      />
      {error && (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const INTEGRATIONS = [
  { name: "Highlight detection model", purpose: "AI Video Clipper" },
  { name: "Speech-to-text", purpose: "Subtitles and Caption Studio" },
  { name: "Media import service", purpose: "Video Downloader (authorized downloads only)" },
  { name: "Video rendering service", purpose: "Exports and clip downloads" },
];

export function SettingsView() {
  const s = useSettingsStore();
  const update = (patch: Partial<Settings>) => s.update(patch);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <GlassCard className="p-5 sm:p-6">
        <CardHeader icon={User} title="Profile" description="How you appear across the workspace." />
        <div className="mt-5 grid gap-4">
          <TextSetting key={`dn-${s.displayName}`} id="display-name" label="Display name" value={s.displayName} onSave={(displayName) => update({ displayName })} />
          <TextSetting key={`ws-${s.workspace}`} id="workspace" label="Workspace name" value={s.workspace} onSave={(workspace) => update({ workspace })} />
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <CardHeader icon={SlidersHorizontal} title="Defaults" description="Used when you start a new project." />
        <div className="mt-5 grid gap-5">
          <div className="grid gap-2">
            <span className="text-sm font-medium">Default aspect ratio</span>
            <AspectPicker value={s.defaultAspect} onChange={(defaultAspect) => update({ defaultAspect })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="def-len">Clip length</Label>
              <Select value={s.defaultClipLength} onValueChange={(v) => update({ defaultClipLength: v as Settings["defaultClipLength"] })}>
                <SelectTrigger id="def-len" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="15-30">15–30s</SelectItem>
                  <SelectItem value="30-60">30–60s</SelectItem>
                  <SelectItem value="60-90">60–90s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="def-q">Export quality</Label>
              <Select value={s.exportQuality} onValueChange={(v) => update({ exportQuality: v as Settings["exportQuality"] })}>
                <SelectTrigger id="def-q" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="def-fps">Frame rate</Label>
              <Select value={s.exportFps} onValueChange={(v) => update({ exportFps: v as Settings["exportFps"] })}>
                <SelectTrigger id="def-fps" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 fps</SelectItem>
                  <SelectItem value="30">30 fps</SelectItem>
                  <SelectItem value="60">60 fps</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="def-lang">Caption language</Label>
            <Select value={s.captionLanguage} onValueChange={(captionLanguage) => update({ captionLanguage })}>
              <SelectTrigger id="def-lang" className="w-full sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="divide-y divide-white/[0.06]">
            <ToggleRow id="auto-captions" label="Auto-generate captions" description="Add subtitles to new clips by default." checked={s.autoCaptions} onChange={(autoCaptions) => update({ autoCaptions })} />
            <ToggleRow id="snapping" label="Timeline snapping" description="Snap clips to edges and the playhead in the editor." checked={s.timelineSnapping} onChange={(timelineSnapping) => update({ timelineSnapping })} />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <CardHeader icon={Accessibility} title="Accessibility" />
        <div className="mt-2">
          <ToggleRow
            id="reduce-motion"
            label="Reduce motion"
            description="Turn off interface animations. Your system setting is always respected."
            checked={s.reduceMotion}
            onChange={(reduceMotion) => update({ reduceMotion })}
          />
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <CardHeader icon={Bell} title="Notifications" description="Email delivery needs an account backend." />
        <div className="mt-2 divide-y divide-white/[0.06]">
          <ToggleRow id="notify-done" label="Processing complete" description="When clips, exports or imports finish." checked={s.notifyOnComplete} onChange={(notifyOnComplete) => update({ notifyOnComplete })} />
          <ToggleRow id="digest" label="Weekly digest" description="A summary of your usage and top clips." checked={s.weeklyDigest} onChange={(weeklyDigest) => update({ weeklyDigest })} />
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <CardHeader icon={Plug} title="AI services" description="Backend connections required for real processing." />
        <ul className="mt-4 grid gap-2">
          {INTEGRATIONS.map((i) => (
            <li key={i.name} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div>
                <p className="text-sm font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.purpose}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" /> Not connected
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <CardHeader icon={Database} title="Your data" description="Projects, media, download history and settings are stored in your Supabase project." />
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="destructive"
            onClick={() => {
              s.reset();
              toast.success("Settings reset to defaults");
            }}
          >
            Reset settings
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
