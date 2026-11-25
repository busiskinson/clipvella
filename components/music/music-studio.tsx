"use client";

import { useState } from "react";
import { PromptForm, type MusicDraft } from "./prompt-form";
import { MusicPlayer } from "./music-player";
import { HistoryList } from "./history-list";
import { InspirationPanel } from "./inspiration-panel";

export function MusicStudio() {
  const [draft, setDraft] = useState<MusicDraft>({
    prompt: "",
    genre: "Lo-fi",
    mood: "Chill",
    voice: "instrumental",
    duration: 60,
    bpm: 90,
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-6">
        <PromptForm draft={draft} setDraft={setDraft} />
        <InspirationPanel draft={draft} setDraft={setDraft} />
      </div>
      <div className="grid min-w-0 content-start gap-6">
        <MusicPlayer />
        <HistoryList />
      </div>
    </div>
  );
}
