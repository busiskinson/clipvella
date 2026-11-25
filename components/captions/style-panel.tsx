"use client";

import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Check, FoldVertical, Palette, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardHeader, GlassCard } from "@/components/common/page";
import { ColorField, Segmented, SliderField } from "@/components/common/fields";
import { useCaptionStore } from "@/stores/caption-store";
import { CAPTION_FONTS, CAPTION_TEMPLATES, DEFAULT_CAPTION_STYLE } from "@/lib/sample-data";
import { CAPTION_FONT_FAMILY } from "@/lib/caption-fonts";
import type { CaptionAlign, CaptionAnimation, CaptionFont, CaptionPosition, CaptionStyle, HighlightMode } from "@/lib/types";
import { cn } from "@/lib/utils";

function TemplateGallery() {
  const templateId = useCaptionStore((s) => s.templateId);
  const apply = useCaptionStore((s) => s.applyTemplate);
  return (
    <ul className="grid grid-cols-2 gap-2">
      {CAPTION_TEMPLATES.map((t) => {
        const st = { ...DEFAULT_CAPTION_STYLE, ...t.style };
        const selected = templateId === t.id;
        return (
          <li key={t.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => apply(t.id)}
              className={cn(
                "relative flex h-full w-full flex-col overflow-hidden rounded-xl border text-left transition-colors duration-200",
                selected ? "border-violet/60 bg-violet/[0.1]" : "border-white/[0.08] hover:border-white/20",
              )}
            >
              <span className="grid h-16 place-items-center bg-[linear-gradient(135deg,#1e1b4b,#4c1d95_60%,#0e7490)] px-2">
                <span
                  className="text-center text-[17px] leading-none"
                  style={{
                    fontFamily: CAPTION_FONT_FAMILY[st.font],
                    fontWeight: st.fontWeight,
                    textTransform: st.uppercase ? "uppercase" : "none",
                    color: st.textColor,
                    background: st.bgOpacity ? `${st.bgColor}${Math.round((st.bgOpacity / 100) * 255).toString(16).padStart(2, "0")}` : undefined,
                    padding: st.bgOpacity ? "3px 6px" : undefined,
                    borderRadius: 4,
                    textShadow: st.outlineWidth ? `0 0 2px ${st.outlineColor}, 0 0 2px ${st.outlineColor}` : undefined,
                  }}
                >
                  Make it <span style={{ color: st.highlightColor }}>pop</span>
                </span>
              </span>
              <span className="p-2.5">
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
              </span>
              {selected && (
                <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-violet text-white">
                  <Check aria-hidden className="size-3" />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function StylePanel() {
  const style = useCaptionStore((s) => s.style);
  const setStyle = useCaptionStore((s) => s.setStyle);
  const resetStyle = useCaptionStore((s) => s.resetStyle);
  const set = <K extends keyof CaptionStyle>(k: K) => (v: CaptionStyle[K]) => setStyle({ [k]: v } as Partial<CaptionStyle>);

  return (
    <GlassCard className="p-5">
      <CardHeader
        icon={Palette}
        title="Caption style"
        description="Changes apply to the preview instantly."
        actions={
          <Button variant="ghost" size="sm" onClick={resetStyle}>
            <RotateCcw aria-hidden /> Reset
          </Button>
        }
      />
      <Tabs defaultValue="templates" className="mt-4">
        <TabsList className="grid h-10 w-full grid-cols-4 bg-black/25 p-1">
          <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
          <TabsTrigger value="text" className="text-xs sm:text-sm">Text</TabsTrigger>
          <TabsTrigger value="effects" className="text-xs sm:text-sm">Effects</TabsTrigger>
          <TabsTrigger value="motion" className="text-xs sm:text-sm">Motion</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <TemplateGallery />
        </TabsContent>

        <TabsContent value="text" className="mt-4 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="cap-font">Font family</Label>
            <Select value={style.font} onValueChange={(v) => set("font")(v as CaptionFont)}>
              <SelectTrigger id="cap-font" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAPTION_FONTS.map((f) => (
                  <SelectItem key={f} value={f}>
                    <span style={{ fontFamily: CAPTION_FONT_FAMILY[f] }}>{f}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderField label="Font size" value={style.fontSize} min={28} max={120} onChange={set("fontSize")} format={(v) => `${v}px`} />
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">Weight</span>
            <Segmented
              label="Font weight"
              size="sm"
              value={String(style.fontWeight) as "400" | "600" | "700" | "800"}
              onChange={(v) => set("fontWeight")(Number(v) as CaptionStyle["fontWeight"])}
              options={[
                { value: "400", label: "Regular" },
                { value: "600", label: "Semi" },
                { value: "700", label: "Bold" },
                { value: "800", label: "Black" },
              ]}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="cap-upper">All caps</Label>
            <Switch id="cap-upper" checked={style.uppercase} onCheckedChange={set("uppercase")} />
          </div>
          <ColorField label="Text color" value={style.textColor} onChange={set("textColor")} />
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">Alignment</span>
            <Segmented<CaptionAlign>
              label="Text alignment"
              value={style.align}
              onChange={set("align")}
              options={[
                { value: "left", label: <AlignLeft aria-hidden className="size-4" />, ariaLabel: "Align left" },
                { value: "center", label: <AlignCenter aria-hidden className="size-4" />, ariaLabel: "Align center" },
                { value: "right", label: <AlignRight aria-hidden className="size-4" />, ariaLabel: "Align right" },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="effects" className="mt-4 grid gap-5">
          <fieldset className="grid gap-4">
            <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Word highlight</legend>
            <Segmented<HighlightMode>
              label="Highlight mode"
              size="sm"
              value={style.highlightMode}
              onChange={set("highlightMode")}
              options={[
                { value: "karaoke", label: "Karaoke" },
                { value: "word-pop", label: "Word pop" },
                { value: "underline", label: "Underline" },
                { value: "none", label: "Off" },
              ]}
            />
            <ColorField label="Highlight color" value={style.highlightColor} onChange={set("highlightColor")} />
          </fieldset>
          <fieldset className="grid gap-4 border-t border-white/[0.06] pt-4">
            <legend className="sr-only">Background</legend>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Background</p>
            <ColorField label="Background color" value={style.bgColor} onChange={set("bgColor")} />
            <SliderField label="Background opacity" value={style.bgOpacity} min={0} max={100} onChange={set("bgOpacity")} format={(v) => `${v}%`} />
          </fieldset>
          <fieldset className="grid gap-4 border-t border-white/[0.06] pt-4">
            <legend className="sr-only">Outline and shadow</legend>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Outline & shadow</p>
            <SliderField label="Outline width" value={style.outlineWidth} min={0} max={8} onChange={set("outlineWidth")} format={(v) => `${v}px`} />
            <ColorField label="Outline color" value={style.outlineColor} onChange={set("outlineColor")} />
            <SliderField label="Shadow blur" value={style.shadowBlur} min={0} max={24} onChange={set("shadowBlur")} format={(v) => `${v}px`} />
            <ColorField label="Shadow color" value={style.shadowColor} onChange={set("shadowColor")} />
          </fieldset>
        </TabsContent>

        <TabsContent value="motion" className="mt-4 grid gap-5">
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">Position</span>
            <Segmented<CaptionPosition>
              label="Caption position"
              value={style.position}
              onChange={set("position")}
              options={[
                { value: "top", label: <><ArrowUpToLine aria-hidden className="size-4" /> Top</> },
                { value: "middle", label: <><FoldVertical aria-hidden className="size-4" /> Middle</> },
                { value: "bottom", label: <><ArrowDownToLine aria-hidden className="size-4" /> Bottom</> },
              ]}
            />
          </div>
          <SliderField label="Vertical offset" value={style.offsetY} min={-20} max={20} onChange={set("offsetY")} format={(v) => `${v > 0 ? "+" : ""}${v}%`} />
          <SliderField label="Words per line" value={style.wordsPerLine} min={1} max={8} onChange={set("wordsPerLine")} />
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">Entrance animation</span>
            <div role="radiogroup" aria-label="Caption animation" className="grid grid-cols-3 gap-2">
              {(
                [
                  ["none", "None"],
                  ["fade", "Fade"],
                  ["pop", "Pop"],
                  ["slide-up", "Slide up"],
                  ["bounce", "Bounce"],
                  ["typewriter", "Typewriter"],
                ] as [CaptionAnimation, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={style.animation === value}
                  onClick={() => set("animation")(value)}
                  className={cn(
                    "h-10 rounded-lg border text-sm font-medium transition-colors duration-200",
                    style.animation === value ? "border-violet/50 bg-violet/[0.12] text-foreground" : "border-white/[0.08] text-muted-foreground hover:border-white/20 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </GlassCard>
  );
}
