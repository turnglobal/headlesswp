import "server-only";

import { getAuthFingerprint, getCacheTtlSeconds, cachedJsonFetch } from "@/lib/cache/http-cache";
import { getEnv, getWpBasicAuthHeader } from "@/lib/config/env";
import { mapWpPageToViewModel, mapWpPostToViewModel } from "@/lib/wp/mappers";
import type { PageViewModel, PostViewModel, WpListResponse, WpPage, WpPost } from "@/types/wp";

function wpApiUrl(path: string, query: Record<string, string | number | undefined> = {}): string {
  const { WP_DOMAIN } = getEnv();
  const url = new URL(`/wp-json/wp/v2${path}`, WP_DOMAIN);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

type WpRootInfo = {
  name?: string;
  description?: string;
};

export async function getWpSiteName(): Promise<string | null> {
  const { WP_DOMAIN } = getEnv();
  const url = new URL("/wp-json/", WP_DOMAIN).toString();

  try {
    const data = await cachedJsonFetch<WpRootInfo>(url);
    const name = data.name?.trim();
    return name && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export async function getWpSiteTagline(): Promise<string | null> {
  const { WP_DOMAIN } = getEnv();
  const url = new URL("/wp-json/", WP_DOMAIN).toString();

  try {
    const data = await cachedJsonFetch<WpRootInfo>(url);
    const description = data.description?.trim();
    return description && description.length > 0 ? description : null;
  } catch {
    return null;
  }
}

export type PaginatedPosts = {
  posts: PostViewModel[];
  totalPages: number;
  totalItems: number;
  currentPage: number;
  perPage: number;
};

function parseHeaderInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function wpAuthedGet(url: string): Promise<Response> {
  const ttl = getCacheTtlSeconds();
  return fetch(url, {
    method: "GET",
    headers: {
      Authorization: getWpBasicAuthHeader(),
    },
    next: {
      revalidate: ttl,
      tags: [`wp:${getAuthFingerprint()}`],
    },
  });
}

export async function getPosts(params: {
  perPage?: number;
  page?: number;
  search?: string;
  sticky?: boolean;
  categories?: number | number[];
  tags?: number | number[];
  author?: number;
  exclude?: number | number[];
} = {}): Promise<PostViewModel[]> {
  const result = await getPaginatedPosts(params);
  return result.posts;
}

export async function getPaginatedPosts(params: {
  perPage?: number;
  page?: number;
  search?: string;
  sticky?: boolean;
  categories?: number | number[];
  tags?: number | number[];
  author?: number;
  exclude?: number | number[];
} = {}): Promise<PaginatedPosts> {
  const categories = Array.isArray(params.categories) ? params.categories.join(",") : params.categories;
  const tags = Array.isArray(params.tags) ? params.tags.join(",") : params.tags;
  const exclude = Array.isArray(params.exclude) ? params.exclude.join(",") : params.exclude;
  const currentPage = params.page ?? 1;
  const perPage = params.perPage ?? 10;

  const url = wpApiUrl("/posts", {
    per_page: perPage,
    page: currentPage,
    search: params.search,
    sticky: params.sticky === undefined ? undefined : params.sticky ? "true" : "false",
    categories,
    tags,
    author: params.author,
    exclude,
    _embed: 1,
  });

  const response = await wpAuthedGet(url);
  const totalPages = parseHeaderInt(response.headers.get("X-WP-TotalPages"), 1);
  const totalItems = parseHeaderInt(response.headers.get("X-WP-Total"), 0);

  if (response.status === 400) {
    return {
      posts: [],
      totalPages,
      totalItems,
      currentPage,
      perPage,
    };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const posts = (await response.json()) as WpListResponse<WpPost>;
  return {
    posts: posts.map(mapWpPostToViewModel),
    totalPages,
    totalItems,
    currentPage,
    perPage,
  };
}

export async function getPostBySlug(slug: string): Promise<PostViewModel | null> {
  const url = wpApiUrl("/posts", {
    slug,
    per_page: 1,
    _embed: 1,
  });

  const posts = await cachedJsonFetch<WpListResponse<WpPost>>(url);
  const post = posts[0];
  return post ? mapWpPostToViewModel(post) : null;
}

export async function getPageBySlug(slug: string): Promise<PageViewModel | null> {
  const url = wpApiUrl("/pages", {
    slug,
    per_page: 1,
    _embed: 1,
  });

  const pages = await cachedJsonFetch<WpListResponse<WpPage>>(url);
  const page = pages[0];
  return page ? mapWpPageToViewModel(page) : null;
}

export async function getCategories(): Promise<Array<{ id: number; name: string; slug: string }>> {
  const url = wpApiUrl("/categories", { per_page: 100 });
  return cachedJsonFetch<Array<{ id: number; name: string; slug: string }>>(url);
}

export async function getCategoryBySlug(slug: string): Promise<{ id: number; name: string; slug: string } | null> {
  const url = wpApiUrl("/categories", { slug, per_page: 1 });
  const categories = await cachedJsonFetch<Array<{ id: number; name: string; slug: string }>>(url);
  return categories[0] ?? null;
}

export async function getTags(): Promise<Array<{ id: number; name: string; slug: string }>> {
  const url = wpApiUrl("/tags", { per_page: 100 });
  return cachedJsonFetch<Array<{ id: number; name: string; slug: string }>>(url);
}

export async function getTagBySlug(slug: string): Promise<{ id: number; name: string; slug: string } | null> {
  const url = wpApiUrl("/tags", { slug, per_page: 1 });
  const tags = await cachedJsonFetch<Array<{ id: number; name: string; slug: string }>>(url);
  return tags[0] ?? null;
}

export async function getUsers(): Promise<Array<{ id: number; name: string; slug: string }>> {
  const url = wpApiUrl("/users", { per_page: 100 });
  return cachedJsonFetch<Array<{ id: number; name: string; slug: string }>>(url);
}

export async function getUserBySlug(slug: string): Promise<{ id: number; name: string; slug: string } | null> {
  const url = wpApiUrl("/users", { slug, per_page: 1 });
  const users = await cachedJsonFetch<Array<{ id: number; name: string; slug: string }>>(url);
  return users[0] ?? null;
}
