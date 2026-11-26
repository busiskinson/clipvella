// Generated from Supabase project wtobecjnjmhovvpwdcic (generate_typescript_types), trimmed of unused helpers.
// Regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums_ = {
  asset_kind: "upload" | "clip" | "render" | "thumbnail" | "audio";
  asset_status: "uploading" | "ready" | "failed";
  clip_status: "pending" | "rendering" | "ready" | "failed";
  job_status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  job_type: "analyze_and_clip" | "render_clip" | "transcribe" | "render_export" | "import_url";
  project_kind: "clip" | "edit" | "captions" | "import";
  project_status: "draft" | "processing" | "ready";
};

type ClipRow = {
  created_at: string;
  description: string;
  end_s: number;
  error: string | null;
  hashtags: string[];
  id: string;
  output_asset_id: string | null;
  owner_id: string;
  project_id: string;
  reason: string | null;
  score: number | null;
  source_asset_id: string;
  start_s: number;
  status: Enums_["clip_status"];
  thumbnail_asset_id: string | null;
  title: string;
  updated_at: string;
};
type DownloadRow = {
  author: string | null;
  created_at: string;
  detail: string | null;
  id: string;
  kind: string;
  owner_id: string;
  platform: string | null;
  project_id: string | null;
  status: string;
  thumbnail_url: string | null;
  title: string;
  url: string | null;
};
type JobRow = {
  attempts: number;
  created_at: string;
  error: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  id: string;
  input: Json;
  locked_at: string | null;
  output: Json | null;
  owner_id: string;
  progress: number;
  project_id: string | null;
  stage: string | null;
  started_at: string | null;
  status: Enums_["job_status"];
  type: Enums_["job_type"];
  worker_id: string | null;
};
type AssetRow = {
  bucket: string;
  created_at: string;
  duration_s: number | null;
  file_name: string | null;
  height: number | null;
  id: string;
  kind: Enums_["asset_kind"];
  mime: string | null;
  owner_id: string;
  path: string;
  size_bytes: number;
  status: Enums_["asset_status"];
  width: number | null;
};
type ProfileRow = {
  created_at: string;
  display_name: string;
  id: string;
  settings: Json;
  updated_at: string;
  workspace: string;
};
type ProjectRow = {
  aspect: string;
  caption_style: Json | null;
  captions: Json;
  created_at: string;
  id: string;
  kind: Enums_["project_kind"];
  link: Json | null;
  name: string;
  owner_id: string;
  settings: Json;
  source_asset_id: string | null;
  status: Enums_["project_status"];
  thumbnail_asset_id: string | null;
  timeline: Json | null;
  updated_at: string;
};
type TranscriptRow = {
  asset_id: string;
  created_at: string;
  id: string;
  language: string | null;
  model: string;
  owner_id: string;
  project_id: string | null;
  provider: string;
  segments: Json;
  text: string;
  words: Json;
};
type WorkerStatusRow = { capabilities: Json; last_seen: string; worker_id: string };

/** Insert = required columns + everything else optional (mirrors the generated Insert types). */
type Ins<R, Req extends keyof R> = Pick<R, Req> & Partial<Omit<R, Req>>;
type Table<R, Req extends keyof R> = {
  Row: R;
  Insert: Ins<R, Req>;
  Update: Partial<R>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      clips: Table<ClipRow, "end_s" | "project_id" | "source_asset_id" | "start_s">;
      downloads: Table<DownloadRow, "status" | "title">;
      jobs: Table<JobRow, "owner_id" | "type">;
      media_assets: Table<AssetRow, "bucket" | "kind" | "path">;
      profiles: Table<ProfileRow, "id">;
      projects: Table<ProjectRow, "kind" | "name">;
      transcripts: Table<TranscriptRow, "asset_id" | "model" | "provider">;
      worker_status: Table<WorkerStatusRow, "worker_id">;
    };
    Views: { [_ in never]: never };
    Functions: {
      usage_summary: { Args: never; Returns: Json };
    };
    Enums: Enums_;
    CompositeTypes: { [_ in never]: never };
  };
};

type T = Database["public"]["Tables"];
export type Tables<K extends keyof T> = T[K]["Row"];
export type TablesInsert<K extends keyof T> = T[K]["Insert"];
export type TablesUpdate<K extends keyof T> = T[K]["Update"];
export type Enums<K extends keyof Enums_> = Enums_[K];
