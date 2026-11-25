import { Anton, Bebas_Neue, Montserrat, Oswald, Poppins, Roboto } from "next/font/google";
import type { CaptionFont } from "./types";

/* Caption fonts are self-hosted by next/font; only loaded on pages that import this module. */
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-cap-montserrat", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-cap-poppins", display: "swap" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-cap-bebas", display: "swap" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-cap-roboto", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-cap-anton", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-cap-oswald", display: "swap" });

/** Apply on a wrapper element so the CSS variables are available to descendants. */
export const captionFontVariables = [montserrat, poppins, bebas, roboto, anton, oswald]
  .map((f) => f.variable)
  .join(" ");

export const CAPTION_FONT_FAMILY: Record<CaptionFont, string> = {
  Montserrat: "var(--font-cap-montserrat), sans-serif",
  Poppins: "var(--font-cap-poppins), sans-serif",
  "Bebas Neue": "var(--font-cap-bebas), sans-serif",
  Roboto: "var(--font-cap-roboto), sans-serif",
  Anton: "var(--font-cap-anton), sans-serif",
  Oswald: "var(--font-cap-oswald), sans-serif",
};
