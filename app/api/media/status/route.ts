import { connection } from "next/server";

/** GET /api/media/status — which optional backend integrations are configured (booleans only, never secrets). */
export async function GET() {
  await connection(); // read env at request time, not at build time
  return Response.json(
    {
      metadata: true, // YouTube + TikTok oEmbed need no credentials
      facebookMetadata: Boolean(process.env.META_OEMBED_ACCESS_TOKEN),
      mediaService: Boolean(process.env.MEDIA_SERVICE_URL),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
