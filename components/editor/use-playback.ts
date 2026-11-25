"use client";

import { useEffect } from "react";
import { contentEnd, useEditorStore } from "@/stores/editor-store";

/** Drives the editor playhead with requestAnimationFrame while playing. */
export function usePlaybackClock() {
  const playing = useEditorStore((s) => s.playing);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const s = useEditorStore.getState();
      const end = contentEnd(s.clips);
      const next = s.playhead + dt;
      if (next >= end) {
        s.setPlayhead(end);
        s.setPlaying(false);
        return;
      }
      s.setPlayhead(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

/** Global editor shortcuts. Ignored while typing in a field. */
export function useEditorShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute("role") === "slider")) return;
      const s = useEditorStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) {
        e.preventDefault();
        s.redo();
      } else if (key === " " && !mod) {
        if (el?.tagName === "BUTTON") return; // let buttons handle Space themselves
        e.preventDefault();
        s.togglePlay();
      } else if (key === "s" && !mod) {
        s.splitAtPlayhead();
      } else if ((key === "delete" || key === "backspace") && !mod) {
        s.deleteSelected();
      } else if (mod && key === "d") {
        e.preventDefault();
        s.duplicateSelected();
      } else if (key === "=" || key === "+") {
        s.setZoom(s.zoom * 1.25);
      } else if (key === "-") {
        s.setZoom(s.zoom / 1.25);
      } else if (key === "arrowleft" && !mod) {
        e.preventDefault();
        s.setPlayhead(s.playhead - (e.shiftKey ? 1 : 1 / 30));
      } else if (key === "arrowright" && !mod) {
        e.preventDefault();
        s.setPlayhead(s.playhead + (e.shiftKey ? 1 : 1 / 30));
      } else if (key === "home") {
        s.setPlayhead(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
