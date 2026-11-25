"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { PLATFORM_LABEL, parseVideoLink } from "@/lib/platforms";
import { resolveLink, recordDownload, updateDownload } from "@/lib/data/downloads";
import { createProject, type ProjectRow } from "@/lib/data/projects";
import { uploadVideo } from "@/lib/upload";
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
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

const NO_AUTHORIZED_SOURCE =
  "There's no authorized way to download this video's file from the platform, so nothing was downloaded. Import your own copy of the video with “Or import a file”.";

export function DownloaderView() {
  const router = useRouter();
  const { openInEditor, openInClipper } = useOpenProject();

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<null | "link" | "file">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [download, setDownload] = useState<DownloadState>({ status: "idle" });
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const historyId = useRef<string | null>(null);
  const request = useRef(0);

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
      const data = await resolveLink(raw.trim());
      if (ticket !== request.current) return;
      if (!data.ok) {
        setError(data.message);
        await recordDownload({ kind: "link", url: link.url, platform: link.platform, title: link.url, status: "failed", detail: data.message });
        return;
      }
      const m = data.media;
      const entry = await recordDownload({
        kind: "link",
        url: m.url,
        platform: m.platform,
        title: m.title ?? `${PLATFORM_LABEL[m.platform]} video`,
        author: m.author,
        thumbnail_url: m.thumbnail,
        status: "analyzed",
      });
      historyId.current = entry.id;
      if (entry.project_id) await updateDownload(entry.id, { status: "imported" });
      if (ticket === request.current) setResult({ kind: "link", media: m, contentType: link.contentType, projectId: entry.project_id ?? undefined });
    } catch (e) {
      if (ticket === request.current) setError(e instanceof Error ? e.message : "Couldn't check that link.");
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
      if (ticket !== request.current) return URL.revokeObjectURL(info.url);
      historyId.current = null;
      setResult({ kind: "file", info });
    } catch (e) {
      if (ticket === request.current) setError(e instanceof Error ? e.message : "That file couldn't be read.");
    } finally {
      if (ticket === request.current) setBusy(null);
    }
  };

  /** Creates the project in Supabase (uploading the file first for local imports). */
  const importResult = async (): Promise<string | null> => {
    if (!result) return null;
    if (result.projectId) return result.projectId;
    try {
      let project: ProjectRow;
      if (result.kind === "link") {
        const m = result.media;
        project = await createProject({
          name: m.title ?? `${PLATFORM_LABEL[m.platform]} video`,
          kind: "import",
          aspect: result.contentType === "video" ? "16:9" : "9:16",
          link: { url: m.url, platform: m.platform, author: m.author, thumbnail: m.thumbnail },
        });
        if (historyId.current) await updateDownload(historyId.current, { status: "imported", project_id: project.id });
      } else {
        const { info } = result;
        setUploadPct(0);
        const uploaded = await uploadVideo(info.file, { info, onProgress: setUploadPct });
        project = await createProject({
          name: info.file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Imported video",
          kind: "import",
          aspect: aspectFromSize(info.width, info.height),
          sourceAssetId: uploaded.asset.id,
          thumbnailAssetId: uploaded.thumbnail?.id ?? null,
          status: "ready",
        });
        await recordDownload({ kind: "file", title: info.file.name, status: "imported", project_id: project.id });
      }
      setResult({ ...result, projectId: project.id });
      toast.success(`Imported “${project.name}”`, {
        description: "It's now in My Projects.",
        action: { label: "View", onClick: () => router.push("/projects") },
      });
      return project.id;
    } catch (e) {
      toast.error("Import failed", { description: e instanceof Error ? e.message : undefined });
      return null;
    } finally {
      setUploadPct(null);
    }
  };

  const requestDownload = async () => {
    if (result?.kind !== "link") return;
    setDownload({ status: "error", message: NO_AUTHORIZED_SOURCE });
    if (historyId.current) await updateDownload(historyId.current, { status: "download-unavailable", detail: NO_AUTHORIZED_SOURCE }).catch(() => undefined);
  };

  const open = async (target: "editor" | "clipper") => {
    const id = await importResult();
    if (!id || !result) return;
    const project = { id, sourceAssetId: result.kind === "file" ? "uploaded" : undefined, source: { type: result.kind } as const };
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
            Paste a TikTok, YouTube or Facebook Reels link to check it and save it to your projects, or import your own video file.
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
              <motion.div
                key={result.kind === "link" ? result.media.url : result.info.url}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ResultCard
                  result={result}
                  uploadPct={uploadPct}
                  onImport={() => void importResult()}
                  onOpenEditor={() => void open("editor")}
                  onOpenClipper={() => void open("clipper")}
                  onDownload={() => void requestDownload()}
                  download={download}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <DropImport
            busy={busy !== null || uploadPct !== null}
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
