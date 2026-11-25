import type { Caption, CaptionStyle, CaptionTemplate, MusicTrack, Project } from "./types";

/**
 * SAMPLE DATA — every value here is illustrative and rendered with a "sample data" label.
 * Replace with API responses once the backend exists.
 */

/** Visual-only scene gradients used for thumbnails and placeholder previews. */
export const SCENES = [
  "linear-gradient(135deg, #1e1b4b 0%, #6d28d9 45%, #38bdf8 100%)",
  "linear-gradient(160deg, #0c4a6e 0%, #0e7490 40%, #c4b5fd 100%)",
  "linear-gradient(135deg, #312e81 0%, #be185d 60%, #fbbf24 100%)",
  "linear-gradient(200deg, #111a2b 0%, #4c1d95 55%, #8b5cf6 100%)",
  "linear-gradient(135deg, #052e16 0%, #0f766e 50%, #38bdf8 100%)",
  "linear-gradient(120deg, #1f2937 0%, #7c3aed 50%, #f472b6 100%)",
] as const;

export const sceneFor = (hue: number) => SCENES[Math.abs(hue) % SCENES.length];

export const SAMPLE_PROJECTS: Project[] = [
  { id: "p1", name: "Founder podcast — Ep. 42", kind: "clip", status: "ready", aspect: "9:16", duration: 3120, updatedAt: "2026-11-24T16:20:00Z", hue: 0, clips: 12 },
  { id: "p2", name: "Product launch teaser", kind: "edit", status: "draft", aspect: "16:9", duration: 74, updatedAt: "2026-11-23T10:05:00Z", hue: 3 },
  { id: "p3", name: "Morning routine vlog", kind: "captions", status: "ready", aspect: "9:16", duration: 182, updatedAt: "2026-11-22T19:41:00Z", hue: 1 },
  { id: "p4", name: "Lo-fi study background", kind: "music", status: "ready", aspect: "16:9", duration: 150, updatedAt: "2026-11-21T08:12:00Z", hue: 2 },
  { id: "p5", name: "Webinar: Scaling teams", kind: "clip", status: "processing", aspect: "1:1", duration: 2640, updatedAt: "2026-11-20T14:30:00Z", hue: 4, clips: 0 },
  { id: "p6", name: "Recipe short — Ramen", kind: "edit", status: "ready", aspect: "9:16", duration: 58, updatedAt: "2026-11-18T12:00:00Z", hue: 5 },
  { id: "p7", name: "Gaming highlights week 47", kind: "clip", status: "ready", aspect: "16:9", duration: 5400, updatedAt: "2026-11-15T21:10:00Z", hue: 3, clips: 18 },
  { id: "p8", name: "Travel diary — Kyoto", kind: "captions", status: "draft", aspect: "4:5", duration: 96, updatedAt: "2026-11-12T09:45:00Z", hue: 1 },
];

export const SAMPLE_USAGE = {
  period: "Nov 1 – Nov 25, 2026",
  stats: [
    { label: "Clips generated", value: 148, delta: "+18%", unit: "" },
    { label: "Minutes processed", value: 612, delta: "+9%", unit: "min" },
    { label: "Captions styled", value: 87, delta: "+31%", unit: "" },
    { label: "Music tracks", value: 24, delta: "+4", unit: "" },
  ],
  /** minutes processed per day, last 14 days */
  daily: [18, 26, 22, 31, 12, 9, 34, 40, 28, 36, 44, 21, 38, 47],
  credits: { used: 612, total: 1000 },
};

export const SAMPLE_CAPTIONS: Caption[] = [
  { id: "c1", start: 0.0, end: 2.6, text: "Here's the one habit that changed everything" },
  { id: "c2", start: 2.6, end: 5.4, text: "I started recording every single idea" },
  { id: "c3", start: 5.4, end: 8.2, text: "and within thirty days my output doubled" },
  { id: "c4", start: 8.2, end: 11.0, text: "Most people wait for the perfect moment" },
  { id: "c5", start: 11.0, end: 14.0, text: "but momentum beats perfection every time" },
];

export const CAPTION_FONTS = ["Montserrat", "Poppins", "Bebas Neue", "Roboto", "Anton", "Oswald"] as const;

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  font: "Montserrat",
  fontSize: 64,
  fontWeight: 800,
  uppercase: false,
  textColor: "#F8FAFC",
  highlightColor: "#C4B5FD",
  bgColor: "#080B14",
  bgOpacity: 0,
  outlineWidth: 3,
  outlineColor: "#080B14",
  shadowBlur: 8,
  shadowColor: "#000000",
  position: "bottom",
  offsetY: 0,
  align: "center",
  highlightMode: "karaoke",
  animation: "pop",
  wordsPerLine: 4,
};

export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  {
    id: "karaoke-violet",
    name: "Karaoke Violet",
    description: "Bold words that fill with colour as they are spoken",
    style: { font: "Montserrat", fontWeight: 800, uppercase: false, textColor: "#F8FAFC", highlightColor: "#C4B5FD", highlightMode: "karaoke", animation: "pop", bgOpacity: 0, outlineWidth: 3, shadowBlur: 8 },
  },
  {
    id: "punch",
    name: "Punch",
    description: "Condensed caps with a word-by-word pop",
    style: { font: "Anton", fontWeight: 400, uppercase: true, textColor: "#FFFFFF", highlightColor: "#FBBF24", highlightMode: "word-pop", animation: "bounce", bgOpacity: 0, outlineWidth: 5, outlineColor: "#000000", wordsPerLine: 3 },
  },
  {
    id: "clean-box",
    name: "Clean Box",
    description: "Readable boxed subtitles for interviews",
    style: { font: "Roboto", fontWeight: 600, uppercase: false, textColor: "#F8FAFC", highlightColor: "#38BDF8", highlightMode: "underline", animation: "fade", bgColor: "#080B14", bgOpacity: 70, outlineWidth: 0, shadowBlur: 0, wordsPerLine: 6 },
  },
  {
    id: "cinema",
    name: "Cinema",
    description: "Tall, quiet type that stays out of the way",
    style: { font: "Bebas Neue", fontWeight: 400, uppercase: true, textColor: "#F8FAFC", highlightColor: "#F8FAFC", highlightMode: "none", animation: "slide-up", bgOpacity: 0, outlineWidth: 0, shadowBlur: 14, wordsPerLine: 6 },
  },
  {
    id: "ice-pop",
    name: "Ice Pop",
    description: "Friendly rounded type with ice-blue highlights",
    style: { font: "Poppins", fontWeight: 700, uppercase: false, textColor: "#FFFFFF", highlightColor: "#38BDF8", highlightMode: "karaoke", animation: "pop", bgOpacity: 0, outlineWidth: 4, outlineColor: "#0C1222", wordsPerLine: 4 },
  },
  {
    id: "headline",
    name: "Headline",
    description: "Oswald caps with a soft background strip",
    style: { font: "Oswald", fontWeight: 600, uppercase: true, textColor: "#F8FAFC", highlightColor: "#C4B5FD", highlightMode: "word-pop", animation: "typewriter", bgColor: "#7C3AED", bgOpacity: 85, outlineWidth: 0, shadowBlur: 0, wordsPerLine: 4 },
  },
];

export const GENRES = ["Lo-fi", "Cinematic", "Electronic", "Hip-hop", "Pop", "Ambient", "Rock", "Acoustic"] as const;
export const MOODS = ["Uplifting", "Chill", "Energetic", "Dark", "Dreamy", "Epic", "Playful", "Melancholic"] as const;

export const SAMPLE_MUSIC: MusicTrack[] = [
  { id: "m1", title: "Midnight Notebook", prompt: "Warm lo-fi beat with vinyl crackle for a late-night study vlog", genre: "Lo-fi", mood: "Chill", voice: "instrumental", duration: 150, bpm: 82, createdAt: "2026-11-24T22:10:00Z", seed: 11, favorite: true },
  { id: "m2", title: "Launch Sequence", prompt: "Rising cinematic synths building to a big drop for a product reveal", genre: "Cinematic", mood: "Epic", voice: "instrumental", duration: 60, bpm: 120, createdAt: "2026-11-23T11:32:00Z", seed: 27, favorite: false },
  { id: "m3", title: "Neon Commute", prompt: "Upbeat electronic groove, bright plucks, city at night", genre: "Electronic", mood: "Energetic", voice: "instrumental", duration: 90, bpm: 124, createdAt: "2026-11-21T08:04:00Z", seed: 43, favorite: false },
];
