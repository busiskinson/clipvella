import { parseVideoLink, type DownloadRequest, type DownloadResponse } from "@/lib/platforms";

/**
 * POST /api/media/download  { url, format, quality }
 *
 * Integration point for an AUTHORIZED media service (MEDIA_SERVICE_URL).
 * That service is responsible for:
 *  - only serving content the user owns or is licensed to use (e.g. platform APIs with the
 *    creator's OAuth consent, or uploads the user controls),
 *  - honouring platform terms, private videos and DRM — never bypassing them,
 *  - transcoding to MP4 / MP3 and returning a short-lived download URL.
 *
 * Without MEDIA_SERVICE_URL this route answers 501 so the UI can say so honestly.
 */

function json(body: DownloadResponse, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: Partial<DownloadRequest>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_link", message: "Send a JSON body with url, format and quality." }, 400);
  }

  const link = typeof body.url === "string" ? parseVideoLink(body.url) : null;
  if (!link || !link.ok) return json({ ok: false, code: "invalid_link", message: link?.message ?? "Missing link." }, 400);
  if (body.format !== "mp4" && body.format !== "mp3") {
    return json({ ok: false, code: "invalid_link", message: "Format must be mp4 or mp3." }, 400);
  }

  const service = process.env.MEDIA_SERVICE_URL;
  if (!service) {
    return json(
      {
        ok: false,
        code: "not_configured",
        message: "Downloads need an authorized media service, which isn't connected yet. Nothing was downloaded.",
      },
      501,
    );
  }

  try {
    const res = await fetch(new URL("/downloads", service), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MEDIA_SERVICE_TOKEN ?? ""}` },
      body: JSON.stringify({ url: link.url, platform: link.platform, format: body.format, quality: body.quality ?? null }),
      cache: "no-store",
    });
    const data = (await res.json()) as DownloadResponse;
    return json(data, res.status);
  } catch {
    return json({ ok: false, code: "upstream_error", message: "The media service couldn't be reached." }, 502);
  }
}
