import type { ClipProps, EffectId } from "@/lib/types";

export const EFFECTS: { id: EffectId; label: string; filter: string }[] = [
  { id: "none", label: "Original", filter: "" },
  { id: "vivid", label: "Vivid", filter: "saturate(1.5) contrast(1.08)" },
  { id: "film", label: "Film", filter: "sepia(0.3) contrast(1.1) brightness(0.96)" },
  { id: "mono", label: "Mono", filter: "grayscale(1) contrast(1.1)" },
  { id: "glow", label: "Glow", filter: "brightness(1.1) saturate(1.25)" },
  { id: "blur", label: "Soft blur", filter: "blur(3px)" },
];

export function filterFor(p: ClipProps) {
  const fx = EFFECTS.find((e) => e.id === p.effect)?.filter ?? "";
  return `brightness(${1 + p.brightness / 100}) contrast(${1 + p.contrast / 100}) saturate(${1 + p.saturation / 100}) ${fx}`.trim();
}

export function transformFor(p: ClipProps) {
  return `translate(${p.positionX}%, ${p.positionY}%) scale(${p.scale / 100}) rotate(${p.rotation}deg)`;
}
