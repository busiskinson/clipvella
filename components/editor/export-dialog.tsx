"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented, SliderField } from "@/components/common/fields";
import { DemoBadge } from "@/components/common/page";
import { contentEnd, useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { formatDuration } from "@/lib/format";

type Format = "mp4" | "webm" | "gif";

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const projectName = useEditorStore((s) => s.projectName);
  const aspect = useEditorStore((s) => s.aspect);
  const duration = useEditorStore((s) => contentEnd(s.clips));
  const defaults = useSettingsStore();
  const [format, setFormat] = useState<Format>("mp4");
  const [resolution, setResolution] = useState<string>(defaults.exportQuality);
  const [fps, setFps] = useState<string>(defaults.exportFps);
  const [bitrate, setBitrate] = useState(70);
  const [state, setState] = useState<"idle" | "rendering" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const start = () => {
    setState("rendering");
    setProgress(0);
    let pct = 0;
    timer.current = setInterval(() => {
      pct = Math.min(100, pct + 4);
      setProgress(pct);
      if (pct >= 100) {
        if (timer.current) clearInterval(timer.current);
        setState("done");
      }
    }, 90);
  };

  const close = (o: boolean) => {
    if (!o) {
      if (timer.current) clearInterval(timer.current);
      setState("idle");
      setProgress(0);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="font-heading">Export video</DialogTitle>
            <DemoBadge label="Simulated render" />
          </div>
          <DialogDescription>
            {projectName} · {aspect} · {formatDuration(duration)}
          </DialogDescription>
        </DialogHeader>

        {state === "idle" ? (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Format</span>
              <Segmented<Format>
                label="Export format"
                value={format}
                onChange={setFormat}
                options={[
                  { value: "mp4", label: "MP4" },
                  { value: "webm", label: "WebM" },
                  { value: "gif", label: "GIF" },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="exp-res">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger id="exp-res" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                    <SelectItem value="4k">4K</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="exp-fps">Frame rate</Label>
                <Select value={fps} onValueChange={setFps}>
                  <SelectTrigger id="exp-fps" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 fps</SelectItem>
                    <SelectItem value="30">30 fps</SelectItem>
                    <SelectItem value="60">60 fps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SliderField label="Quality" value={bitrate} min={10} max={100} onChange={setBitrate} format={(v) => (v > 80 ? "High" : v > 45 ? "Recommended" : "Small file")} />
          </div>
        ) : (
          <div className="grid gap-3 py-2" aria-live="polite">
            <div className="flex items-center gap-2 text-sm">
              {state === "done" ? <CheckCircle2 aria-hidden className="size-4 text-success" /> : <Loader2 aria-hidden className="size-4 animate-spin text-lavender" />}
              {state === "done" ? "Render simulation finished" : `Rendering ${format.toUpperCase()} · ${resolution} · ${fps} fps`}
            </div>
            <Progress value={progress} aria-label="Export progress" className="h-2" />
            {state === "done" && (
              <p className="text-xs text-muted-foreground">
                No file was produced. Connect the rendering service to export real {format.toUpperCase()} files.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {state === "done" ? (
            <Button
              onClick={() => {
                toast.info("Export is simulated", { description: "Real files will download here once rendering is connected." });
                close(false);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={start} disabled={state === "rendering"}>
                <Download aria-hidden /> Export
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
