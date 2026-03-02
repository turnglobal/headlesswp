import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type RedirectRule = {
  from: string;
  to?: string;
  status?: 301 | 302 | 410;
  gone?: boolean;
};

let cache: RedirectRule[] | null = null;

function normalizePath(input: string): string {
  if (!input.startsWith("/")) {
    return `/${input}`;
  }

  if (input.length > 1 && input.endsWith("/")) {
    return input.slice(0, -1);
  }

  return input;
}

export async function loadRedirects(): Promise<RedirectRule[]> {
  if (cache) {
    return cache;
  }

  try {
    const filePath = path.join(process.cwd(), "redirects.json");
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as RedirectRule[];

    cache = parsed.map((rule) => ({
      ...rule,
      from: normalizePath(rule.from),
    }));

    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

export async function resolveRedirect(pathname: string): Promise<
  | { type: "redirect"; status: 301 | 302; to: string }
  | { type: "gone"; status: 410 }
  | null
> {
  const normalized = normalizePath(pathname);
  const rules = await loadRedirects();

  const matched = rules.find((rule) => rule.from === normalized);
  if (!matched) {
    return null;
  }

  if (matched.gone || matched.status === 410) {
    return { type: "gone", status: 410 };
  }

  const status = matched.status === 302 ? 302 : 301;
  if (!matched.to) {
    return null;
  }

  return {
    type: "redirect",
    status,
    to: matched.to,
  };
}
