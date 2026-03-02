import "server-only";

import { NextResponse } from "next/server";
import { buildEdgeCacheControl, getCacheTtlSeconds } from "@/lib/cache/http-cache";
import { getEnv, getWpBasicAuthHeader } from "@/lib/config/env";
import { getSourceMediaUrlFromRequestPath } from "@/lib/media/cache-url";

export const runtime = "nodejs";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const sourceUrl = getSourceMediaUrlFromRequestPath(requestUrl.pathname, requestUrl.searchParams);
  if (!sourceUrl) {
    return new NextResponse("Invalid media path", { status: 400 });
  }

  let parsedSource: URL;
  try {
    parsedSource = new URL(sourceUrl);
  } catch {
    return new NextResponse("Invalid media URL", { status: 400 });
  }

  const wpOrigin = new URL(getEnv().WP_DOMAIN).origin;
  if (parsedSource.origin !== wpOrigin) {
    return new NextResponse("External media URL is not allowed", { status: 403 });
  }

  let upstream: Response;
  try {
    const headers = new Headers();
    headers.set("Authorization", getWpBasicAuthHeader());

    upstream = await fetch(sourceUrl, {
      headers,
      redirect: "manual",
      next: {
        revalidate: getCacheTtlSeconds(),
      },
    });
  } catch {
    return new NextResponse("Failed to fetch media", { status: 502 });
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return new NextResponse("Unexpected media redirect", { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse("Media not found", { status: upstream.status === 404 ? 404 : 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const normalizedContentType = contentType.split(";")[0].trim().toLowerCase();
  const isImage = normalizedContentType.startsWith("image/");
  const isSvg = normalizedContentType === "image/svg+xml";
  if (!isImage || isSvg) {
    return new NextResponse("Only non-SVG images are supported. Please use external embeds for video.", {
      status: 415,
    });
  }
  const contentLengthHeader = upstream.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return new NextResponse("Image is too large", { status: 413 });
    }
  }
  if (!upstream.body) {
    return new NextResponse("Failed to stream media", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": buildEdgeCacheControl(),
    },
  });
}
