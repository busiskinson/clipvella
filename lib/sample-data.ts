import type { Caption, CaptionStyle, CaptionTemplate } from "./types";

/**
 * Static catalogues (caption fonts, templates, default caption style, decorative gradients).
 * SAMPLE_CAPTIONS is only the starter text shown in Caption Studio before a project is opened.
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
