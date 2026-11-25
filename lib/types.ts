export type ProjectKind = "clip" | "edit" | "captions" | "music";
export type ProjectStatus = "draft" | "processing" | "ready";
export type AspectRatio = "9:16" | "1:1" | "16:9" | "4:5";

export interface Project {
  id: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  aspect: AspectRatio;
  /** seconds */
  duration: number;
  /** ISO date string */
  updatedAt: string;
  /** index into the scene gradient list, purely visual */
  hue: number;
  clips?: number;
}

/* ---------- Editor ---------- */
export type TrackKind = "video" | "overlay" | "caption" | "audio";

export interface TimelineClip {
  id: string;
  trackId: string;
  name: string;
  /** start position on the timeline (s) */
  start: number;
  /** length on the timeline (s) */
  duration: number;
  /** offset into the source media (s) */
  sourceIn: number;
  mediaId?: string;
  hue: number;
  props: ClipProps;
}

export interface ClipProps {
  opacity: number; // 0-100
  scale: number; // 50-200 (%)
  rotation: number; // -180..180
  positionX: number; // -50..50 (%)
  positionY: number; // -50..50 (%)
  volume: number; // 0-200 (%)
  speed: number; // 0.25-4
  brightness: number; // -50..50
  contrast: number; // -50..50
  saturation: number; // -50..50
  effect: EffectId;
}

export type EffectId = "none" | "glow" | "film" | "mono" | "vivid" | "blur";

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
}

export interface MediaItem {
  id: string;
  name: string;
  kind: "video" | "audio" | "image";
  duration: number;
  /** object URL for files imported this session; undefined for sample media */
  url?: string;
  hue: number;
}

/* ---------- Captions ---------- */
export interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
}

export type CaptionFont =
  | "Montserrat"
  | "Poppins"
  | "Bebas Neue"
  | "Roboto"
  | "Anton"
  | "Oswald";

export type CaptionAnimation = "none" | "fade" | "pop" | "slide-up" | "bounce" | "typewriter";
export type HighlightMode = "none" | "karaoke" | "word-pop" | "underline";
export type CaptionPosition = "top" | "middle" | "bottom";
export type CaptionAlign = "left" | "center" | "right";

export interface CaptionStyle {
  font: CaptionFont;
  fontSize: number; // px at 1080 reference width, rendered scaled
  fontWeight: 400 | 600 | 700 | 800;
  uppercase: boolean;
  textColor: string;
  highlightColor: string;
  bgColor: string;
  bgOpacity: number; // 0-100
  outlineWidth: number; // 0-8
  outlineColor: string;
  shadowBlur: number; // 0-24
  shadowColor: string;
  position: CaptionPosition;
  offsetY: number; // -20..20 (%)
  align: CaptionAlign;
  highlightMode: HighlightMode;
  animation: CaptionAnimation;
  wordsPerLine: number; // 2-8
}

export interface CaptionTemplate {
  id: string;
  name: string;
  description: string;
  style: Partial<CaptionStyle>;
}

/* ---------- Music ---------- */
export type MusicVoice = "instrumental" | "vocal";

export interface MusicTrack {
  id: string;
  title: string;
  prompt: string;
  genre: string;
  mood: string;
  voice: MusicVoice;
  duration: number;
  bpm: number;
  createdAt: string;
  seed: number;
  favorite: boolean;
}

/* ---------- Clipper ---------- */
export interface GeneratedClip {
  id: string;
  title: string;
  start: number;
  end: number;
  score: number; // 0-100 virality score (simulated)
  hook: string;
  hue: number;
  tags: string[];
}
