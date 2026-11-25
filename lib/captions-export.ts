import type { Caption } from "@/lib/types";

function stamp(seconds: number, sep: "," | "."): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

/** SubRip (.srt) */
export function toSrt(lines: Caption[]): string {
  return lines.map((l, i) => `${i + 1}\n${stamp(l.start, ",")} --> ${stamp(l.end, ",")}\n${l.text.trim()}\n`).join("\n");
}

/** WebVTT (.vtt) */
export function toVtt(lines: Caption[]): string {
  return `WEBVTT\n\n${lines.map((l) => `${stamp(l.start, ".")} --> ${stamp(l.end, ".")}\n${l.text.trim()}\n`).join("\n")}`;
}

export function downloadText(fileName: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
