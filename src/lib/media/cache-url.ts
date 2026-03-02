import "server-only";

import { getEnv } from "@/lib/config/env";

export function toCachedMediaUrl(rawUrl: string): string {
  if (!rawUrl) {
    return "";
  }

  const { WP_DOMAIN } = getEnv();
  const wpBase = new URL(WP_DOMAIN);

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === wpBase.hostname && parsed.pathname.startsWith("/wp-content/uploads/")) {
      const query = parsed.search ? `?__qs=${encodeURIComponent(parsed.search.slice(1))}` : "";
      return `/media-cache${parsed.pathname}${query}`;
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

export function getSourceMediaUrlFromRequestPath(pathname: string, searchParams: URLSearchParams): string | null {
  const { WP_DOMAIN } = getEnv();
  if (!pathname.startsWith("/media-cache/")) return null;
  if (pathname.startsWith("/media-cache/external/")) return null;

  const wpBase = new URL(WP_DOMAIN);
  const path = pathname.replace("/media-cache", "");
  if (!path.startsWith("/")) return null;
  if (!path.startsWith("/wp-content/uploads/")) return null;
  const qs = searchParams.get("__qs");
  const query = qs ? `?${qs}` : "";
  return `${wpBase.origin}${path}${query}`;
}
