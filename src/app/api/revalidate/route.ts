import "server-only";

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";
import { getAuthFingerprint } from "@/lib/cache/http-cache";

export const runtime = "nodejs";

function getSecretFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret");
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();

  const fromHeader = request.headers.get("x-revalidate-secret");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();

  return null;
}

function assertAuthorized(request: Request): NextResponse | null {
  const { REVALIDATE_SECRET } = getEnv();
  if (!REVALIDATE_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: "REVALIDATE_SECRET is not configured",
      },
      { status: 503 },
    );
  }

  const provided = getSecretFromRequest(request);
  if (!provided || provided !== REVALIDATE_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  return null;
}

function runRevalidation(): NextResponse {
  const tag = `wp:${getAuthFingerprint()}`;
  revalidateTag(tag, "max");

  return NextResponse.json({
    ok: true,
    revalidatedTag: tag,
    at: new Date().toISOString(),
  });
}

export async function POST(request: Request): Promise<Response> {
  const authError = assertAuthorized(request);
  if (authError) return authError;
  return runRevalidation();
}

export async function GET(request: Request): Promise<Response> {
  const authError = assertAuthorized(request);
  if (authError) return authError;
  return runRevalidation();
}
