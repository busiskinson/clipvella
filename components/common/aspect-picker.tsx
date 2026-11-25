"use client";

import type { AspectRatio } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { id: AspectRatio; label: string; w: number; h: number }[] = [
  { id: "9:16", label: "Vertical", w: 9, h: 16 },
  { id: "1:1", label: "Square", w: 12, h: 12 },
  { id: "4:5", label: "Portrait", w: 10, h: 12.5 },
  { id: "16:9", label: "Wide", w: 16, h: 9 },
];

export function AspectPicker({
  value,
  onChange,
  className,
}: {
  value: AspectRatio;
  onChange: (v: AspectRatio) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Aspect ratio" className={cn("grid grid-cols-4 gap-2", className)}>
      {OPTIONS.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 transition-colors duration-200",
              selected ? "border-violet/50 bg-violet/[0.12]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
            )}
          >
            <span className="grid h-7 place-items-center">
              <span
                aria-hidden
                className={cn("block rounded-[3px] border-2", selected ? "border-lavender" : "border-muted-foreground/60")}
                style={{ width: o.w * 1.4, height: o.h * 1.4 }}
              />
            </span>
            <span className="text-xs font-medium">{o.id}</span>
            <span className="sr-only">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
