"use client";

import { memo } from "react";
import type { Caption, CaptionStyle } from "@/lib/types";
import { wordsFor } from "@/stores/caption-store";
import { CAPTION_FONT_FAMILY } from "@/lib/caption-fonts";

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const ENTER_ANIMATION: Record<CaptionStyle["animation"], string | undefined> = {
  none: undefined,
  fade: "cf-fade 260ms ease-out both",
  pop: "cf-pop 320ms cubic-bezier(.2,.9,.3,1.2) both",
  "slide-up": "cf-slide-up 300ms ease-out both",
  bounce: "cf-pop 280ms ease-out both",
  typewriter: undefined,
};

/**
 * Renders the caption active at `time` inside a `@container` parent.
 * Font size is defined at a 1080px reference width and scales with the frame.
 */
export const CaptionOverlay = memo(function CaptionOverlay({
  captions,
  style,
  time,
}: {
  captions: Caption[];
  style: CaptionStyle;
  time: number;
}) {
  const caption = captions.find((c) => time >= c.start && time < c.end);
  if (!caption) return null;

  const allWords = wordsFor(caption);
  // chunk words into "pages" of wordsPerLine and show the page containing the current word
  const per = Math.max(1, style.wordsPerLine);
  const currentIdx = Math.max(0, allWords.findIndex((w) => time >= w.start && time < w.end));
  const pageStart = Math.floor(currentIdx / per) * per;
  const words = allWords.slice(pageStart, pageStart + per);

  const scale = (px: number) => `calc(${px} / 1080 * 100cqw)`;
  const shadows: string[] = [];
  if (style.outlineWidth > 0) {
    const w = style.outlineWidth;
    // 8-direction outline that also works on wide letterforms
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      shadows.push(`${scale(x * w)} ${scale(y * w)} 0 ${style.outlineColor}`);
    }
  }
  if (style.shadowBlur > 0) shadows.push(`0 ${scale(style.shadowBlur / 3)} ${scale(style.shadowBlur)} ${hexToRgba(style.shadowColor, 0.85)}`);

  const vertical = style.position === "top" ? { top: `${12 + style.offsetY}%` } : style.position === "middle" ? { top: `calc(50% + ${style.offsetY}%)`, transform: "translateY(-50%)" } : { bottom: `${14 - style.offsetY}%` };

  return (
    <div
      className="pointer-events-none absolute inset-x-[6%] flex"
      style={{ ...vertical, justifyContent: style.align === "left" ? "flex-start" : style.align === "right" ? "flex-end" : "center" }}
      aria-live="off"
    >
      <p
        key={`${caption.id}-${pageStart}`}
        style={{
          fontFamily: CAPTION_FONT_FAMILY[style.font],
          fontSize: scale(style.fontSize),
          fontWeight: style.fontWeight,
          lineHeight: 1.15,
          textAlign: style.align,
          textTransform: style.uppercase ? "uppercase" : "none",
          color: style.textColor,
          textShadow: shadows.join(", ") || undefined,
          background: style.bgOpacity > 0 ? hexToRgba(style.bgColor, style.bgOpacity / 100) : undefined,
          padding: style.bgOpacity > 0 ? `${scale(10)} ${scale(22)}` : undefined,
          borderRadius: scale(14),
          animation: ENTER_ANIMATION[style.animation],
          maxWidth: "100%",
          overflowWrap: "break-word",
        }}
      >
        {words.map((w, i) => {
          const active = time >= w.start && time < w.end;
          const spoken = time >= w.end;
          if (style.animation === "typewriter" && time < w.start) return null;

          let color = style.textColor;
          let transform: string | undefined;
          let textDecoration: string | undefined;
          let display: string | undefined;
          let animation: string | undefined;

          switch (style.highlightMode) {
            case "karaoke":
              if (active || spoken) color = style.highlightColor;
              break;
            case "word-pop":
              if (active) {
                color = style.highlightColor;
                transform = "scale(1.12)";
                display = "inline-block";
              }
              break;
            case "underline":
              if (active) {
                textDecoration = `underline ${style.highlightColor}`;
              }
              break;
          }
          if (style.animation === "bounce" && active) {
            display = "inline-block";
            animation = "cf-bounce 420ms ease-in-out";
          }
          if (style.animation === "typewriter") animation = "cf-fade 140ms ease-out both";

          return (
            <span key={`${w.text}-${i}`}>
              <span
                style={{
                  color,
                  transform,
                  display,
                  animation,
                  textDecoration,
                  textDecorationThickness: textDecoration ? scale(6) : undefined,
                  textUnderlineOffset: textDecoration ? scale(10) : undefined,
                  transition: "color 120ms linear, transform 140ms ease-out",
                }}
              >
                {w.text}
              </span>
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </p>
    </div>
  );
});
