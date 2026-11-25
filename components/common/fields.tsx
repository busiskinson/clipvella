"use client";

import { useId } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function SliderField({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  format = (v) => String(v),
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("grid gap-2.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <label id={id} className="text-muted-foreground">
          {label}
        </label>
        <span className="tabular-nums text-foreground">{format(value)}</span>
      </div>
      <Slider
        aria-labelledby={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={([v]) => onCommit?.(v)}
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1 pr-2 pl-1">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-white/20 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <span className="w-[62px] font-mono text-xs uppercase tabular-nums text-foreground">{value}</span>
      </div>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  ariaLabel?: string;
}

/** Accessible single-select segmented control (radiogroup). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "default",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex w-full rounded-xl border border-white/[0.08] bg-black/20 p-1", className)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
        onChange(next.value);
        const btn = e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`);
        btn?.focus();
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.ariaLabel}
            data-value={o.value}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors duration-200",
              size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm",
              selected
                ? "bg-white/[0.1] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
