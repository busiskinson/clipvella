"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { JobProgress } from "@/components/common/job-progress";
import { GlassCard } from "@/components/common/page";
import { useSettingsStore } from "@/stores/settings-store";
import { useClipperStore } from "@/stores/clipper-store";
import { createClient } from "@/lib/supabase/client";
import { createProject, getProjectRow, getSignedUrl, updateProject, type AssetRow, type ProjectRow } from "@/lib/data/projects";
import { createJob, latestJob, useJob } from "@/lib/data/jobs";
import { listClips, useClipsRealtime } from "@/lib/data/clips";
import { useQuery } from "@/lib/data/use-query";
import { useProjects } from "@/lib/data/hooks";
import { uploadVideo } from "@/lib/upload";
import { CAPTION_TEMPLATES, DEFAULT_CAPTION_STYLE } from "@/lib/sample-data";
import type { AspectRatio } from "@/lib/types";
import { aspectFromSize } from "@/components/downloader/shared";
import { SourcePanel } from "./source-panel";
import { ClipSettings } from "./clip-settings";
import { ClipResults } from "./clip-results";

export function ClipperWorkspace() {
  const router = useRouter();
  const projectId = useSearchParams().get("project");
  const settings = useClipperStore();
  const defaults = useSettingsStore();

  // Loaded state is tagged with the project id it belongs to, so switching projects never shows stale data.
  const [loaded, setLoaded] = useState<{ id: string; project: ProjectRow | null; asset: AssetRow | null; videoUrl: string | null }>({ id: "", project: null, asset: null, videoUrl: null });
  const [jobFor, setJobFor] = useState<{ id: string; jobId: string | null }>({ id: "", jobId: null });
  const current = projectId && loaded.id === projectId ? loaded : null;
  const project = current?.project ?? null;
  const asset = current?.asset ?? null;
  const videoUrl = current?.videoUrl ?? null;
  const jobId = projectId && jobFor.id === projectId ? jobFor.jobId : null;
  const setJobId = (id: string | null) => projectId && setJobFor({ id: projectId, jobId: id });
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const job = useJob(jobId);
  const { data: projects } = useProjects();
  const clipsQuery = useQuery(() => (projectId ? listClips(projectId) : Promise.resolve([])), [projectId]);
  useClipsRealtime(projectId);

  // apply workspace defaults from Settings once the profile is loaded
  const setClipper = settings.set;
  useEffect(() => {
    if (!defaults.loaded) return;
    setClipper({ aspect: defaults.defaultAspect, clipLength: defaults.defaultClipLength, autoSubtitles: defaults.autoCaptions, subtitleLanguage: defaults.captionLanguage });
  }, [defaults.loaded, defaults.defaultAspect, defaults.defaultClipLength, defaults.autoCaptions, defaults.captionLanguage, setClipper]);

  // load the project, its source video and its latest clipping job
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    (async () => {
      try {
        const p = await getProjectRow(projectId);
        const last = await latestJob(projectId, "analyze_and_clip");
        let a: AssetRow | null = null;
        let url: string | null = null;
        if (p.source_asset_id) {
          const res = await createClient().from("media_assets").select("*").eq("id", p.source_asset_id).single();
          if (res.error) throw res.error;
          a = res.data;
          url = await getSignedUrl(a.bucket, a.path);
        }
        if (!alive) return;
        setLoaded({ id: projectId, project: p, asset: a, videoUrl: url });
        setJobFor({ id: projectId, jobId: last?.id ?? null });
      } catch (e) {
        toast.error("Couldn't open that project", { description: e instanceof Error ? e.message : undefined });
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const candidates = useMemo(() => (projects ?? []).filter((p) => p.sourceAssetId && p.id !== projectId && (p.kind === "import" || p.kind === "clip")), [projects, projectId]);

  const onFile = async (file: File) => {
    setUploadPct(0);
    try {
      const up = await uploadVideo(file, { onProgress: setUploadPct });
      if (project && !project.source_asset_id && (project.kind === "clip" || project.kind === "import")) {
        await updateProject(project.id, { source_asset_id: up.asset.id, thumbnail_asset_id: up.thumbnail?.id ?? null, status: "ready" });
        setLoaded({ id: project.id, project: { ...project, source_asset_id: up.asset.id }, asset: up.asset, videoUrl: await getSignedUrl(up.asset.bucket, up.asset.path) });
      } else {
        const p = await createProject({
          name: file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "New clip project",
          kind: "clip",
          aspect: aspectFromSize(up.info.width, up.info.height),
          sourceAssetId: up.asset.id,
          thumbnailAssetId: up.thumbnail?.id ?? null,
          status: "ready",
        });
        router.replace(`/clipper?project=${p.id}`);
      }
      toast.success("Video uploaded");
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploadPct(null);
    }
  };

  const captionStyle = () => {
    const tpl = CAPTION_TEMPLATES.find((t) => t.id === settings.subtitleTemplate);
    return { ...DEFAULT_CAPTION_STYLE, ...(tpl?.style ?? {}) };
  };

  const generate = async () => {
    if (!project || !asset) return;
    const res = await createJob("analyze_and_clip", {
      project_id: project.id,
      asset_id: asset.id,
      count: settings.clipCount,
      length: settings.clipLength,
      aspect: settings.aspect,
      subtitles: settings.autoSubtitles,
      language: settings.subtitleLanguage,
      caption_style: settings.autoSubtitles ? captionStyle() : null,
    });
    if (!res.ok) {
      toast.error("Couldn't start clipping", { description: res.message });
      return;
    }
    setJobId(res.job.id);
    if (res.reused) toast.info("This video is already being processed");
  };

  const busy = !!job && (job.status === "queued" || job.status === "running");
  const clips = clipsQuery.data ?? [];
  const aspect = (((project?.settings as { clipper?: { aspect?: string } } | null)?.clipper?.aspect as AspectRatio | undefined) ?? settings.aspect) as AspectRatio;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid min-w-0 content-start gap-6">
        <SourcePanel
          project={project}
          asset={asset}
          videoUrl={videoUrl}
          candidates={candidates}
          uploadPct={uploadPct}
          onFile={(f) => void onFile(f)}
          onPick={(id) => router.replace(`/clipper?project=${id}`)}
        />
        {job && (
          <GlassCard className="p-5">
            <h2 className="mb-3 text-[15px] font-semibold">AI analysis</h2>
            <JobProgress job={job} onRetry={() => void generate()} className="border-0 bg-transparent p-0" />
          </GlassCard>
        )}
        <ClipResults clips={clips} aspect={aspect} subtitles={settings.autoSubtitles} captionStyle={settings.autoSubtitles ? captionStyle() : null} loading={clipsQuery.loading} />
      </div>
      <div className="min-w-0 xl:sticky xl:top-22 xl:self-start">
        <ClipSettings
          onGenerate={() => void generate()}
          busy={busy}
          canGenerate={!!asset && uploadPct === null}
          hasClips={clips.length > 0}
          disabledReason={uploadPct !== null ? "Waiting for the upload to finish." : "Add a source video to enable generation."}
        />
      </div>
    </div>
  );
}
