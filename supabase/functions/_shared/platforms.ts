export type SupportedPlatform = "youtube" | "tiktok" | "facebook";

/**
 * Link parsing shared by the Video Downloader UI and its API routes.
 * Pure functions only — safe to import on the server and in the browser.
 */

export const PLATFORM_LABEL: Record<SupportedPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook Reels",
};

export type ParsedLink =
  | {
      ok: true;
      platform: SupportedPlatform;
      /** canonical URL we send to oEmbed / the media service */
      url: string;
      /** platform video id when it can be read from the link */
      id: string | null;
      /** short links (vm.tiktok.com, fb.watch…) have to be expanded by the platform */
      shortLink: boolean;
      contentType: "video" | "short" | "reel";
    }
  | { ok: false; reason: "empty" | "invalid" | "unsupported" | "not-a-video"; message: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function hostOf(url: URL) {
  return url.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, "");
}

export function parseVideoLink(raw: string): ParsedLink {
  const input = raw.trim();
  if (!input) return { ok: false, reason: "empty", message: "Paste a video link to get started." };

  if (/\s/.test(input) || !input.includes(".")) {
    return { ok: false, reason: "invalid", message: "That doesn't look like a valid link." };
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, reason: "invalid", message: "That doesn't look like a valid link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "invalid", message: "Only http and https links are supported." };
  }
  const host = hostOf(url);
  const parts = url.pathname.split("/").filter(Boolean);

  // ---------- YouTube ----------
  if (host === "youtube.com" || host === "youtu.be" || host === "music.youtube.com") {
    let id: string | null = null;
    let contentType: "video" | "short" = "video";
    if (host === "youtu.be") id = parts[0] ?? null;
    else if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed") {
      id = parts[1] ?? null;
      if (parts[0] === "shorts") contentType = "short";
    }
    if (!id || !YT_ID.test(id)) {
      return { ok: false, reason: "not-a-video", message: "This YouTube link isn't a single video. Channel and playlist links aren't supported." };
    }
    return { ok: true, platform: "youtube", id, url: `https://www.youtube.com/watch?v=${id}`, shortLink: false, contentType };
  }

  // ---------- TikTok ----------
  if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    if (host !== "tiktok.com") {
      return { ok: true, platform: "tiktok", id: null, url: `https://${host}${url.pathname}`, shortLink: true, contentType: "short" };
    }
    const videoIdx = parts.indexOf("video");
    const id = videoIdx >= 0 ? parts[videoIdx + 1] : parts[0] === "v" ? parts[1]?.replace(/\.html$/, "") : undefined;
    if (!id || !/^\d{8,25}$/.test(id)) {
      return { ok: false, reason: "not-a-video", message: "This TikTok link isn't a video. Profile, photo and sound links aren't supported." };
    }
    const user = parts[0]?.startsWith("@") ? parts[0] : "@_";
    return { ok: true, platform: "tiktok", id, url: `https://www.tiktok.com/${user}/video/${id}`, shortLink: false, contentType: "short" };
  }

  // ---------- Facebook Reels / videos ----------
  if (host === "facebook.com" || host === "fb.watch") {
    if (host === "fb.watch") {
      return { ok: true, platform: "facebook", id: null, url: `https://fb.watch${url.pathname}`, shortLink: true, contentType: "reel" };
    }
    let id: string | null = null;
    let contentType: "video" | "reel" = "video";
    if (parts[0] === "reel" || parts[0] === "reels") {
      id = parts[1] ?? null;
      contentType = "reel";
    } else if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts[0] === "share" && (parts[1] === "r" || parts[1] === "v")) {
      return { ok: true, platform: "facebook", id: null, url: `https://www.facebook.com${url.pathname}`, shortLink: true, contentType: parts[1] === "r" ? "reel" : "video" };
    } else if (parts[1] === "videos") id = parts[parts.length - 1] ?? null;
    if (!id || !/^\d{5,25}$/.test(id)) {
      return { ok: false, reason: "not-a-video", message: "This Facebook link isn't a Reel or video. Page, profile and post links aren't supported." };
    }
    const canonical = contentType === "reel" ? `https://www.facebook.com/reel/${id}` : `https://www.facebook.com/watch/?v=${id}`;
    return { ok: true, platform: "facebook", id, url: canonical, shortLink: false, contentType };
  }

  return {
    ok: false,
    reason: "unsupported",
    message: "Only TikTok, YouTube and Facebook Reels links are supported.",
  };
}

/* ---------- API contracts (shared by route handlers and the UI) ---------- */

export interface ResolvedMedia {
  platform: SupportedPlatform;
  url: string;
  id: string | null;
  /** null when the platform does not expose metadata without credentials */
  title: string | null;
  author: string | null;
  authorUrl: string | null;
  thumbnail: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  /** official embeddable player (YouTube privacy-enhanced / TikTok player); loaded only on request */
  embedUrl: string | null;
  /** player frame size from oEmbed — used to tell portrait from landscape */
  frameWidth: number | null;
  frameHeight: number | null;
  /** oEmbed never includes duration; filled only by a configured media service */
  duration: number | null;
  /** formats reported by the media service; null when no service is configured */
  formats: MediaFormat[] | null;
  metadataSource: "oembed" | "media-service" | "none";
  notice: string | null;
}

export interface MediaFormat {
  container: "mp4" | "mp3";
  quality: string | null;
}

export type ResolveResponse = { ok: true; media: ResolvedMedia } | { ok: false; code: ResolveErrorCode; message: string };

export type ResolveErrorCode =
  | "invalid_link"
  | "private_or_unavailable"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "timeout";

export interface DownloadRequest {
  url: string;
  format: "mp4" | "mp3";
  quality: string | null;
}

export type DownloadResponse =
  | { ok: true; downloadUrl: string; fileName: string }
  | { ok: false; code: "not_configured" | "invalid_link" | "not_permitted" | "upstream_error"; message: string };
