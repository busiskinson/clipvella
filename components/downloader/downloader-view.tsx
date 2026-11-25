"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { PLATFORM_LABEL, parseVideoLink, type DownloadResponse, type ResolveResponse } from "@/lib/platforms";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/stores/project-store";
import { useDownloaderStore } from "@/stores/downloader-store";
import { useMediaRegistry } from "@/stores/media-registry";
import { useOpenProject } from "@/components/common/use-open-project";
import { UrlBar } from "./url-bar";
import { ResultCard, type DownloadState, type Result } from "./result-card";
import { DropImport } from "./drop-import";
import { HistoryPanel } from "./history-panel";
import { BackendStatus } from "./backend-status";
import { aspectFromSize, readLocalVideo } from "./shared";

function ResultSkeleton({ label }: { label: string }) {
  return (
    <div className="glass grid gap-5 rounded-2xl p-4 sm:p-5 md:grid-cols-[240px_1fr]" role="status" aria-live="polite">
      <div className="aspect-video animate-pulse rounded-xl bg-white/[0.06]" />
      <div className="grid content-start gap-3">
        <div className="h-5 w-3/4 animate-pulse rounded bg-white/[0.08]" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-white/[0.06]" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.05]" />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export function DownloaderView() {
  const router = useRouter();
  const addImportedProject = useProjectStore((s) => s.addImportedProject);
  const record = useDownloaderStore((s) => s.record);
  const updateHistory = useDownloaderStore((s) => s.update);
  const { openInEditor, openInClipper } = useOpenProject();

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<null | "link" | "file">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [download, setDownload] = useState<DownloadState>({ status: "idle" });
  const historyId = useRef<string | null>(null);
  const request = useRef(0);

  /** Free the previous local preview unless it was imported (then projects still use it). */
  const releasePrevious = () => {
    if (result?.kind === "file" && !result.projectId) URL.revokeObjectURL(result.info.url);
  };

  const analyze = async (raw: string) => {
    const link = parseVideoLink(raw);
    if (!link.ok) {
      setError(link.message);
      return;
    }
    const ticket = ++request.current;
    releasePrevious();
    setInput(raw.trim());
    setError(null);
    setResult(null);
    setDownload({ status: "idle" });
    setBusy("link");
    try {
      const res = await fetch("/api/media/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw.trim() }),
      });
      const data = (await res.json()) as ResolveResponse;
      if (ticket !== request.current) return;
      if (!data.ok) {
        setError(data.message);
        record({ kind: "link", url: link.url, platform: link.platform, title: link.url, status: "failed", detail: data.message });
        return;
      }
      const m = data.media;
      const entry = record({
        kind: "link",
        url: m.url,
        platform: m.platform,
        title: m.title ?? `${PLATFORM_LABEL[m.platform]} video`,
        author: m.author,
        thumbnail: m.thumbnail,
        status: "analyzed",
      });
      historyId.current = entry.id;
      // Already imported earlier? Reuse that project instead of creating a duplicate.
      const existing = entry.projectId && useProjectStore.getState().projects.some((p) => p.id === entry.projectId) ? entry.projectId : undefined;
      if (existing) updateHistory(entry.id, { status: "imported" });
      setResult({ kind: "link", media: m, contentType: link.contentType, projectId: existing });
    } catch {
      if (ticket === request.current) setError("Couldn't reach the ClipForge server. Check your connection and try again.");
    } finally {
      if (ticket === request.current) setBusy(null);
    }
  };

  const acceptFile = async (file: File) => {
    const ticket = ++request.current;
    releasePrevious();
    setError(null);
    setResult(null);
    setDownload({ status: "idle" });
    setBusy("file");
    try {
      const info = await readLocalVideo(file);
      if (ticket !== request.current) {
        URL.revokeObjectURL(info.url);
        return;
      }
      historyId.current = null;
      setResult({ kind: "file", info });
    } catch (e) {
      if (ticket === request.current) setError(e instanceof Error ? e.message : "That file couldn't be read.");
    } finally {
      if (ticket === request.current) setBusy(null);
    }
  };

  const importResult = (): Project | null => {
    if (!result) return null;
    if (result.projectId) return useProjectStore.getState().projects.find((p) => p.id === result.projectId) ?? null;

    let project: Project;
    if (result.kind === "link") {
      const m = result.media;
      project = addImportedProject({
        name: m.title ?? `${PLATFORM_LABEL[m.platform]} video`,
        aspect: result.contentType === "video" ? "16:9" : "9:16",
        duration: m.duration ?? 0,
        source: { type: "link", url: m.url, platform: m.platform, author: m.author ?? undefined, thumbnail: m.thumbnail ?? undefined },
      });
      if (historyId.current) updateHistory(historyId.current, { status: "imported", projectId: project.id });
    } else {
      const { info } = result;
      project = addImportedProject({
        name: info.file.name.replace(/\.[^.]+$/, ""),
        aspect: aspectFromSize(info.width, info.height),
        duration: info.duration,
        source: { type: "file", fileName: info.file.name, fileSize: info.file.size, thumbnail: info.thumbnail ?? undefined },
      });
      useMediaRegistry.getState().register(project.id, { url: info.url, name: info.file.name, size: info.file.size, duration: info.duration });
      record({ kind: "file", title: info.file.name, thumbnail: info.thumbnail, status: "imported", projectId: project.id });
    }
    setResult({ ...result, projectId: project.id });
    toast.success(`Imported “${project.name}”`, {
      description: "It's now in My Projects.",
      action: { label: "View", onClick: () => router.push("/projects") },
    });
    return project;
  };

  const requestDownload = async (format: "mp4" | "mp3", quality: string) => {
    if (result?.kind !== "link") return;
    setDownload({ status: "working" });
    try {
      const res = await fetch("/api/media/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.media.url, format, quality }),
      });
      const data = (await res.json()) as DownloadResponse;
      if (data.ok) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = data.fileName;
        a.rel = "noopener";
        a.click();
        setDownload({ status: "done", message: `Downloading ${data.fileName}` });
        if (historyId.current) updateHistory(historyId.current, { status: "downloaded", format, quality });
      } else {
        setDownload({ status: "error", message: data.message });
        if (historyId.current) {
          updateHistory(historyId.current, { status: data.code === "not_configured" ? "download-unavailable" : "failed", format, quality, detail: data.message });
        }
      }
    } catch {
      setDownload({ status: "error", message: "Couldn't reach the ClipForge server." });
    }
  };

  const open = (target: "editor" | "clipper") => {
    const project = importResult();
    if (!project) return;
    if (target === "editor") openInEditor(project);
    else openInClipper(project);
  };

  return (
    <div className="grid gap-6">
      <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 size-96 -translate-x-1/2 rounded-full bg-violet/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold text-balance sm:text-3xl">
            Bring any video into <span className="text-gradient">ClipForge</span>
          </h2>
          <p className="mx-auto mt-2 mb-6 max-w-xl text-center text-[15px] text-muted-foreground text-pretty">
            Paste a TikTok, YouTube or Facebook Reels link to check it, see its details and import it into your projects.
          </p>
          <UrlBar
            value={input}
            onChange={(v) => {
              setInput(v);
              if (error) setError(null);
            }}
            onSubmit={analyze}
            busy={busy !== null}
            error={error}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="grid min-w-0 content-start gap-6">
          <AnimatePresence mode="wait">
            {busy ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResultSkeleton label={busy === "link" ? "Checking the link with the platform…" : "Reading your file…"} />
              </motion.div>
            ) : result ? (
              <motion.div key={result.kind === "link" ? result.media.url : result.info.url} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <ResultCard
                  result={result}
                  onImport={importResult}
                  onOpenEditor={() => open("editor")}
                  onOpenClipper={() => open("clipper")}
                  onDownload={requestDownload}
                  download={download}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <DropImport
            busy={busy !== null}
            onFile={acceptFile}
            onLink={(url) => {
              setInput(url);
              void analyze(url);
            }}
          />
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <HistoryPanel
            onReanalyze={(url) => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              void analyze(url);
            }}
          />
          <BackendStatus />
        </div>
      </div>
    </div>
  );
}
