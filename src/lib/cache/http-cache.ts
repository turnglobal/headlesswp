import "server-only";

import { createHash } from "node:crypto";
import { getEnv, getWpBasicAuthHeader } from "@/lib/config/env";

export function getCacheTtlSeconds(): number {
  return getEnv().CACHE_TTL_SECONDS;
}

export function getMediaCacheTtlSeconds(): number {
  return getEnv().MEDIA_CACHE_TTL_SECONDS;
}

export function getAuthFingerprint(): string {
  const auth = getWpBasicAuthHeader();
  return createHash("sha256").update(auth).digest("hex");
}

type CachedJsonOptions = {
  auth?: boolean;
  headers?: HeadersInit;
};

export async function cachedJsonFetch<T>(url: string, options: CachedJsonOptions = {}): Promise<T> {
  const { auth = true, headers = {} } = options;
  const ttl = getCacheTtlSeconds();
  const mergedHeaders = new Headers(headers);

  if (auth) {
    mergedHeaders.set("Authorization", getWpBasicAuthHeader());
  }

  const response = await fetch(url, {
    method: "GET",
    headers: mergedHeaders,
    next: {
      revalidate: ttl,
      tags: [`wp:${getAuthFingerprint()}`],
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}

export function buildEdgeCacheControl(ttl: number = getCacheTtlSeconds()): string {
  return `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}`;
}
