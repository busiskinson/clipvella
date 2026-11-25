import { parseVideoLink, type ResolveResponse, type ResolvedMedia } from "@/lib/platforms";

/**
 * POST /api/media/resolve  { url }
 *
 * Reads PUBLIC metadata (title, author, thumbnail) through each platform's official
 * oEmbed endpoint. It never fetches the video file, never sends cookies or credentials,
 * and private / restricted videos simply fail with `private_or_unavailable`.
 *
 * Facebook requires a Meta app token for oEmbed (META_OEMBED_ACCESS_TOKEN).
 * Duration and format lists need a media service (MEDIA_SERVICE_URL) — see README notes.
 */

const TIMEOUT_MS = 8000;

interface OEmbed {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  width?: number | string;
  height?: number | string;
  html?: string;
}

const num = (v: number | string | undefined) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Only accept player URLs on the platform's own hosts. */
function embedFrom(platform: ResolvedMedia["platform"], id: string | null, html?: string): string | null {
  if (platform === "youtube" && id) return `https://www.youtube-nocookie.com/embed/${id}`;
  const src = html?.match(/src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  if (!src) return null;
  try {
    const u = new URL(src);
    const allowed = platform === "tiktok" ? u.hostname === "www.tiktok.com" && u.pathname.startsWith("/player/") : u.hostname.endsWith("facebook.com");
    if (!allowed) return null;
    u.searchParams.set("autoplay", "0");
    return u.toString();
  } catch {
    return null;
  }
}

function json(body: ResolveResponse, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function oembedEndpoint(platform: ResolvedMedia["platform"], url: string): string | null {
  const u = encodeURIComponent(url);
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/oembed?format=json&url=${u}`;
    case "tiktok":
      return `https://www.tiktok.com/oembed?url=${u}`;
    case "facebook": {
      const token = process.env.META_OEMBED_ACCESS_TOKEN;
      return token ? `https://graph.facebook.com/v21.0/oembed_video?url=${u}&access_token=${encodeURIComponent(token)}` : null;
    }
  }
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = (await request.json())?.url;
  } catch {
    return json({ ok: false, code: "invalid_link", message: "Send a JSON body with a url field." }, 400);
  }
  if (typeof raw !== "string" || raw.length > 2048) {
    return json({ ok: false, code: "invalid_link", message: "Send a single video link." }, 400);
  }

  const link = parseVideoLink(raw);
  if (!link.ok) return json({ ok: false, code: "invalid_link", message: link.message }, 400);

  const base: ResolvedMedia = {
    platform: link.platform,
    url: link.url,
    id: link.id,
    title: null,
    author: null,
    authorUrl: null,
    thumbnail: null,
    thumbnailWidth: null,
    thumbnailHeight: null,
    embedUrl: link.platform === "youtube" && link.id ? `https://www.youtube-nocookie.com/embed/${link.id}` : null,
    frameWidth: null,
    frameHeight: null,
    duration: null,
    formats: null,
    metadataSource: "none",
    notice: null,
  };

  const endpoint = oembedEndpoint(link.platform, link.url);
  if (!endpoint) {
    return json({
      ok: true,
      media: {
        ...base,
        notice: "Facebook only shares video details with a registered Meta app. Add META_OEMBED_ACCESS_TOKEN on the server to show the title and thumbnail.",
      },
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "ClipForgeAI/0.1 (oEmbed metadata)" },
      cache: "no-store",
      redirect: "follow",
    });

    if (res.status === 401 || res.status === 403) {
      return json({ ok: false, code: "private_or_unavailable", message: "This video is private, age-restricted or doesn't allow sharing. Only public videos can be imported." }, 422);
    }
    if (res.status === 404 || res.status === 400) {
      return json({ ok: false, code: "not_found", message: "The platform couldn't find this video. It may have been removed, or the link is incomplete." }, 404);
    }
    if (res.status === 429) {
      return json({ ok: false, code: "rate_limited", message: "The platform is rate-limiting requests. Try again in a minute." }, 429);
    }
    if (!res.ok) {
      return json({ ok: false, code: "upstream_error", message: `The platform responded with an error (${res.status}). Try again later.` }, 502);
    }

    const data = (await res.json()) as OEmbed;
    const title = data.title?.trim() || null;
    return json({
      ok: true,
      media: {
        ...base,
        title,
        author: data.author_name?.trim() || null,
        authorUrl: data.author_url ?? null,
        thumbnail: data.thumbnail_url ?? null,
        thumbnailWidth: data.thumbnail_width ?? null,
        thumbnailHeight: data.thumbnail_height ?? null,
        embedUrl: embedFrom(link.platform, link.id, data.html),
        frameWidth: num(data.width),
        frameHeight: num(data.height),
        metadataSource: "oembed",
        notice:
          !title && !data.thumbnail_url
            ? `${link.platform === "tiktok" ? "TikTok" : "The platform"} only shares an embeddable player for this video, not its title or thumbnail. Use Play preview to watch it.`
            : null,
      },
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return json(
      { ok: false, code: aborted ? "timeout" : "upstream_error", message: aborted ? "The platform took too long to respond." : "Couldn't reach the platform. Check your connection and try again." },
      504,
    );
  } finally {
    clearTimeout(timer);
  }
}
