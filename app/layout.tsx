import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shell/providers";

// Typography from UI UX Pro Max "Tech Startup" pairing: Space Grotesk headings + DM Sans body.
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "ClipForge AI", template: "%s · ClipForge AI" },
  description: "AI-powered clipping, editing, captions and video import for short-form video.",
};

export const viewport: Viewport = {
  themeColor: "#080B14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${dmSans.variable} ${spaceGrotesk.variable} h-full`}>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
