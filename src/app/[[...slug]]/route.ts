import "server-only";

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";
import { resolveRedirect } from "@/lib/routing/redirects";
import { buildHtmlDocument, buildThemeStyleBlock } from "@/lib/theme/document";
import { getThemeIcons, type ThemeIcons } from "@/lib/theme/icons";
import { loadThemeHeadScripts, loadThemeTokens, renderThemeTemplate } from "@/lib/theme/renderer";
import {
  getCategoryBySlug,
  getCategories,
  getPageBySlug,
  getPaginatedPosts,
  getPostBySlug,
  getPosts,
  getTagBySlug,
  getUserBySlug,
  getWpSiteName,
  getWpSiteTagline,
} from "@/lib/wp/client";
import type { ThemeTokens } from "@/types/theme";
import type { PageViewModel, PostViewModel } from "@/types/wp";

export const dynamic = "force-dynamic";
const DEFAULT_SITE_NAME = "my-site";

type LayoutContext = {
  siteName: string;
  siteTagline: string;
  hasCategories: boolean;
  hasAboutPage: boolean;
  hasContactPage: boolean;
  hasPrivacyPolicyPage: boolean;
  icons: ThemeIcons;
};

type TocItem = {
  id: string;
  title: string;
  children: Array<{ id: string; title: string }>;
};

type SocialImage = {
  url: string;
  width?: number | null;
  height?: number | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createCspNonce(): string {
  return randomBytes(16).toString("base64");
}

function applyNonceToScriptTags(html: string, nonce: string): string {
  return html.replace(/<script\\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\\bnonce\\s*=\\s*[\"']/i.test(attrs)) return full;
    return `<script${attrs} nonce=\"${escapeHtml(nonce)}\">`;
  });
}

async function getCustomHeadHtml(themeName: string, nonce: string): Promise<string> {
  const raw = await loadThemeHeadScripts(themeName);
  if (!raw) return "";
  return applyNonceToScriptTags(raw, nonce);
}

function buildContentSecurityPolicy(nonce: string): string {
  const nonceToken = `'nonce-${nonce}'`;
  return [
    "default-src 'self'",
    `script-src 'self' ${nonceToken}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "trusted-types default",
    "require-trusted-types-for 'script'",
  ].join("; ");
}

function buildResponseHeaders(contentType: string, nonce: string): Headers {
  return new Headers({
    "Content-Type": contentType,
    "Content-Security-Policy": buildContentSecurityPolicy(nonce),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  });
}

function htmlResponse(html: string, status: number, nonce: string): NextResponse {
  return new NextResponse(html, {
    status,
    headers: buildResponseHeaders("text/html; charset=utf-8", nonce),
  });
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function trimTo160(input: string): string {
  const text = stripHtml(input);
  if (text.length <= 160) return text;
  return `${text.slice(0, 160).trimEnd()}...`;
}

function buildSocialHead(params: {
  title: string;
  description: string;
  canonicalUrl: string;
  image?: SocialImage | null;
  type?: "website" | "article";
}): string {
  const { title, description, canonicalUrl, image, type = "website" } = params;
  const tags = [
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta name="twitter:card" content="${image?.url ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];

  if (image?.url) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image.url)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image.url)}">`);
    if (image.width) tags.push(`<meta property="og:image:width" content="${image.width}">`);
    if (image.height) tags.push(`<meta property="og:image:height" content="${image.height}">`);
  }

  return tags.join("\n");
}

function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildJsonLdScript(data: unknown, nonce: string): string {
  return `<script type="application/ld+json" nonce="${escapeHtml(nonce)}">${safeJsonForScript(data)}</script>`;
}

function buildBreadcrumbSchema(pathname: string, publicOrigin: string, label: string): Record<string, unknown> {
  const segments = pathname.split("/").filter(Boolean);
  const items: Array<Record<string, unknown>> = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: toAbsoluteUrl("/", publicOrigin),
    },
  ];

  if (segments.length === 0) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: label,
      item: toAbsoluteUrl(pathname, publicOrigin),
    });
  } else {
    segments.forEach((segment, index) => {
      const href = `/${segments.slice(0, index + 1).join("/")}`;
      const isLast = index === segments.length - 1;
      items.push({
        "@type": "ListItem",
        position: index + 2,
        name: isLast ? label : segment.replace(/-/g, " "),
        item: toAbsoluteUrl(href, publicOrigin),
      });
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

function buildCommonJsonLdHead(params: {
  siteName: string;
  title: string;
  description: string;
  canonicalUrl: string;
  pathname: string;
  publicOrigin: string;
  nonce: string;
  logoPath?: string;
}): string {
  const { siteName, title, description, canonicalUrl, pathname, publicOrigin, nonce, logoPath } = params;
  const websiteId = `${publicOrigin}#website`;
  const organizationId = `${publicOrigin}#organization`;
  const webpageId = `${canonicalUrl}#webpage`;
  const possibleLogo = logoPath ? toAbsoluteUrl(logoPath, publicOrigin) : undefined;

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    name: siteName,
    url: publicOrigin,
    inLanguage: "en",
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId,
    name: siteName,
    url: publicOrigin,
    ...(possibleLogo ? { logo: { "@type": "ImageObject", url: possibleLogo } } : {}),
  };

  const webpageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": webpageId,
    url: canonicalUrl,
    name: title,
    description,
    isPartOf: { "@id": websiteId },
    about: { "@id": organizationId },
  };

  const breadcrumbSchema = buildBreadcrumbSchema(pathname, publicOrigin, title);

  return [
    buildJsonLdScript(websiteSchema, nonce),
    buildJsonLdScript(organizationSchema, nonce),
    buildJsonLdScript(webpageSchema, nonce),
    buildJsonLdScript(breadcrumbSchema, nonce),
  ].join("\n");
}

function buildPostJsonLdHead(params: {
  siteName: string;
  post: PostViewModel;
  description: string;
  canonicalUrl: string;
  pathname: string;
  publicOrigin: string;
  nonce: string;
  logoPath?: string;
}): string {
  const { siteName, post, description, canonicalUrl, pathname, publicOrigin, nonce, logoPath } = params;
  const organizationId = `${publicOrigin}#organization`;
  const articleId = `${canonicalUrl}#article`;

  const blogPostingSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": articleId,
    headline: post.title,
    description,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: {
      "@type": "Person",
      name: post.author.name,
      url: toAbsoluteUrl(`/author/${post.author.slug}`, publicOrigin),
    },
    publisher: {
      "@type": "Organization",
      "@id": organizationId,
      name: siteName,
      ...(logoPath ? { logo: { "@type": "ImageObject", url: toAbsoluteUrl(logoPath, publicOrigin) } } : {}),
    },
  };

  if (post.primaryCategoryName) {
    blogPostingSchema.articleSection = post.primaryCategoryName;
  }
  if (post.tags.length > 0) {
    blogPostingSchema.keywords = post.tags.map((tag) => tag.name).join(", ");
  }
  if (post.featuredImage?.url) {
    blogPostingSchema.image = {
      "@type": "ImageObject",
      url: post.featuredImage.url,
      ...(post.featuredImage.width ? { width: post.featuredImage.width } : {}),
      ...(post.featuredImage.height ? { height: post.featuredImage.height } : {}),
    };
  }

  const common = buildCommonJsonLdHead({
    siteName,
    title: post.title,
    description,
    canonicalUrl,
    pathname,
    publicOrigin,
    nonce,
    logoPath,
  });

  return [common, buildJsonLdScript(blogPostingSchema, nonce)].filter(Boolean).join("\n");
}

function lastSlug(pathSegments: string[]): string {
  return pathSegments[pathSegments.length - 1] ?? "";
}

function toPositiveInt(input: string | null, fallback: number): number {
  if (!input) return fallback;
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPublicOrigin(request: Request): string {
  const configuredDomain = getEnv().DOMAIN;
  if (configuredDomain) return configuredDomain;

  try {
    return new URL(request.url).origin;
  } catch {
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;
    return "http://localhost:3000";
  }
}

function toAbsoluteUrl(pathname: string, origin: string, search: string = ""): string {
  return new URL(`${pathname}${search}`, origin).toString();
}

function resolveHtmlDirection(theme: ThemeTokens): "ltr" | "rtl" {
  return theme.direction === "rtl" ? "rtl" : "ltr";
}

function resolveFaviconHref(theme: ThemeTokens): string {
  if (typeof theme.faviconPath === "string" && theme.faviconPath.trim()) return theme.faviconPath.trim();
  if (typeof theme.logoPath === "string" && theme.logoPath.trim()) return theme.logoPath.trim();
  return "/favicon.ico";
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function splitAfterFirstParagraph(html: string): { leadHtml: string; remainingHtml: string } {
  const firstParagraphCloseIndex = html.search(/<\/p>/i);
  if (firstParagraphCloseIndex === -1) return { leadHtml: "", remainingHtml: html };
  const splitIndex = firstParagraphCloseIndex + 4;
  return { leadHtml: html.slice(0, splitIndex), remainingHtml: html.slice(splitIndex) };
}

function buildTocAndInjectHeadingIds(contentHtml: string): { contentHtmlWithIds: string; tocItems: TocItem[] } {
  const headingRegex = /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi;
  const usedIds = new Set<string>();
  const tocItems: TocItem[] = [];
  let currentH2: TocItem | null = null;

  const contentHtmlWithIds = contentHtml.replace(headingRegex, (fullMatch, tag: string, attrs: string, innerHtml: string) => {
    const text = stripHtml(innerHtml);
    if (!text) return fullMatch;

    const existingIdMatch = attrs.match(/\sid=(["'])(.*?)\1/i);
    const id = existingIdMatch?.[2]?.trim() || toSlug(text) || `${tag.toLowerCase()}-section`;
    let uniqueId = id;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(uniqueId);

    const level = tag.toLowerCase();
    if (level === "h2") {
      currentH2 = { id: uniqueId, title: text, children: [] };
      tocItems.push(currentH2);
    } else if (level === "h3") {
      if (!currentH2) {
        currentH2 = { id: "overview", title: "Overview", children: [] };
        if (!tocItems.some((item) => item.id === "overview")) tocItems.push(currentH2);
      }
      currentH2.children.push({ id: uniqueId, title: text });
    }

    const attrsWithoutId = attrs.replace(/\sid=(["']).*?\1/i, "");
    return `<${tag}${attrsWithoutId} id="${uniqueId}">${innerHtml}</${tag}>`;
  });

  return { contentHtmlWithIds, tocItems };
}

async function getLayoutContext(themeSiteName?: string): Promise<LayoutContext> {
  const [wpSiteName, wpSiteTagline, categories, aboutPage, contactPage, privacyPolicyPage, icons] = await Promise.all([
    getWpSiteName(),
    getWpSiteTagline(),
    getCategories(),
    getPageBySlug("about"),
    getPageBySlug("contact"),
    getPageBySlug("privacy-policy"),
    getThemeIcons(),
  ]);

  return {
    siteName: wpSiteName ?? themeSiteName ?? DEFAULT_SITE_NAME,
    siteTagline: wpSiteTagline ?? "",
    hasCategories: categories.length > 0,
    hasAboutPage: Boolean(aboutPage),
    hasContactPage: Boolean(contactPage),
    hasPrivacyPolicyPage: Boolean(privacyPolicyPage),
    icons,
  };
}

function templateForPageSlug(slug: string): "contact" | "privacy-policy" | null {
  if (slug === "contact") return "contact";
  if (slug === "privacy-policy") return "privacy-policy";
  return null;
}

async function renderErrorPage(status: 404 | 410, pathname: string, publicOrigin: string): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin);

  const bodyHtml = await renderThemeTemplate("components/404", {
    ...layout,
    cspNonce,
    searchQuery: "",
    status,
    isGone: status === 410,
    pathname,
    currentYear: new Date().getFullYear(),
  });

  const description = "The requested page could not be found.";
  const pageTitle = `${layout.siteName} | ${status === 410 ? "Gone" : "Page Not Found"}`;
  const html = buildHtmlDocument({
    title: pageTitle,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({
        title: pageTitle,
        description,
        canonicalUrl: publicUrl,
      }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title: pageTitle,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, status, cspNonce);
}

async function renderHome(pathname: string, publicOrigin: string, requestedPage: number): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const [heroPosts, paginatedStories] = await Promise.all([
    getPosts({ perPage: 4, sticky: true }),
    getPaginatedPosts({ perPage: 20, page: requestedPage, sticky: false }),
  ]);

  if (paginatedStories.totalPages > 0 && requestedPage > paginatedStories.totalPages) {
    return renderErrorPage(404, pathname, publicOrigin);
  }

  const currentPage = requestedPage;
  const totalPages = paginatedStories.totalPages;
  const latestStories = paginatedStories.posts;
  const paginationPages = Array.from({ length: totalPages }, (_, idx) => {
    const pageNumber = idx + 1;
    return { number: pageNumber, href: pageNumber === 1 ? "/" : `/?page=${pageNumber}`, isCurrent: pageNumber === currentPage };
  });

  const pageSuffix = currentPage > 1 ? `?page=${currentPage}` : "";
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin, pageSuffix);
  const description = layout.siteTagline || "Latest stories and editorial highlights.";

  const bodyHtml = await renderThemeTemplate("home", {
    ...layout,
    cspNonce,
    searchQuery: "",
    heroPosts,
    latestStories,
    pagination: { currentPage, totalPages, totalItems: paginatedStories.totalItems, pages: paginationPages, hasPagination: totalPages > 1 },
    currentYear: new Date().getFullYear(),
  });

  const html = buildHtmlDocument({
    title: layout.siteName,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({ title: layout.siteName, description, canonicalUrl: publicUrl }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title: layout.siteName,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
    includeSwiperCss: true,
  });

  return htmlResponse(html, 200, cspNonce);
}

async function renderSearch(pathname: string, publicOrigin: string, query: string): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const searchQuery = query.trim();
  const results = searchQuery ? await getPosts({ perPage: 24, search: searchQuery }) : [];
  const searchSuffix = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : "";
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin, searchSuffix);
  const title = searchQuery ? `Search: ${searchQuery} | ${layout.siteName}` : `Search | ${layout.siteName}`;
  const description = searchQuery ? `Search results for ${searchQuery} on ${layout.siteName}.` : `Search content on ${layout.siteName}.`;

  const bodyHtml = await renderThemeTemplate("search", {
    ...layout,
    cspNonce,
    searchQuery,
    results,
    currentYear: new Date().getFullYear(),
  });

  const html = buildHtmlDocument({
    title,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({ title, description, canonicalUrl: publicUrl }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, 200, cspNonce);
}

async function renderCategories(pathname: string, publicOrigin: string): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const categories = await getCategories();
  if (categories.length === 0) return renderErrorPage(404, pathname, publicOrigin);

  const publicUrl = toAbsoluteUrl(pathname, publicOrigin);
  const title = `${layout.siteName} | Categories`;
  const description = `Browse categories on ${layout.siteName}.`;

  const bodyHtml = await renderThemeTemplate("categories", {
    ...layout,
    cspNonce,
    searchQuery: "",
    categories,
    currentYear: new Date().getFullYear(),
  });

  const html = buildHtmlDocument({
    title,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({ title, description, canonicalUrl: publicUrl }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, 200, cspNonce);
}

async function renderTagArchive(pathname: string, publicOrigin: string, tagSlug: string, requestedPage: number): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const tag = await getTagBySlug(tagSlug);
  if (!tag) return renderErrorPage(404, pathname, publicOrigin);

  const paginatedStories = await getPaginatedPosts({ perPage: 20, page: requestedPage, sticky: false, tags: [tag.id] });
  if (paginatedStories.totalPages > 0 && requestedPage > paginatedStories.totalPages) return renderErrorPage(404, pathname, publicOrigin);

  const currentPage = requestedPage;
  const totalPages = paginatedStories.totalPages;
  const latestStories = paginatedStories.posts;
  const paginationPages = Array.from({ length: totalPages }, (_, idx) => {
    const pageNumber = idx + 1;
    return { number: pageNumber, href: pageNumber === 1 ? `/tag/${tag.slug}` : `/tag/${tag.slug}?page=${pageNumber}`, isCurrent: pageNumber === currentPage };
  });

  const pageSuffix = currentPage > 1 ? `?page=${currentPage}` : "";
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin, pageSuffix);
  const title = `${layout.siteName} | Tag: ${tag.name}`;
  const description = `Posts tagged ${tag.name} on ${layout.siteName}.`;

  const bodyHtml = await renderThemeTemplate("tag", {
    ...layout,
    cspNonce,
    searchQuery: "",
    tag,
    latestStories,
    pagination: { currentPage, totalPages, totalItems: paginatedStories.totalItems, pages: paginationPages, hasPagination: totalPages > 1 },
    currentYear: new Date().getFullYear(),
  });

  const html = buildHtmlDocument({
    title,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({ title, description, canonicalUrl: publicUrl }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, 200, cspNonce);
}

async function renderArticles(pathname: string, publicOrigin: string, requestedPage: number): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const paginatedStories = await getPaginatedPosts({ perPage: 20, page: requestedPage, sticky: false });
  if (paginatedStories.totalPages > 0 && requestedPage > paginatedStories.totalPages) return renderErrorPage(404, pathname, publicOrigin);

  const currentPage = requestedPage;
  const totalPages = paginatedStories.totalPages;
  const latestStories = paginatedStories.posts;
  const paginationPages = Array.from({ length: totalPages }, (_, idx) => {
    const pageNumber = idx + 1;
    return { number: pageNumber, href: pageNumber === 1 ? "/articles" : `/articles?page=${pageNumber}`, isCurrent: pageNumber === currentPage };
  });

  const pageSuffix = currentPage > 1 ? `?page=${currentPage}` : "";
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin, pageSuffix);
  const title = `${layout.siteName} | Articles`;
  const description = `All articles on ${layout.siteName}.`;

  const bodyHtml = await renderThemeTemplate("articles", {
    ...layout,
    cspNonce,
    searchQuery: "",
    latestStories,
    pagination: { currentPage, totalPages, totalItems: paginatedStories.totalItems, pages: paginationPages, hasPagination: totalPages > 1 },
    currentYear: new Date().getFullYear(),
  });

  const html = buildHtmlDocument({
    title,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({ title, description, canonicalUrl: publicUrl }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, 200, cspNonce);
}

async function renderCategoryArchive(
  pathname: string,
  publicOrigin: string,
  categorySlug: string,
  requestedPage: number,
): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return renderErrorPage(404, pathname, publicOrigin);

  const paginatedStories = await getPaginatedPosts({ perPage: 20, page: requestedPage, sticky: false, categories: [category.id] });
  if (paginatedStories.totalPages > 0 && requestedPage > paginatedStories.totalPages) return renderErrorPage(404, pathname, publicOrigin);

  const currentPage = requestedPage;
  const totalPages = paginatedStories.totalPages;
  const latestStories = paginatedStories.posts;
  const paginationPages = Array.from({ length: totalPages }, (_, idx) => {
    const pageNumber = idx + 1;
    return {
      number: pageNumber,
      href: pageNumber === 1 ? `/categories/${category.slug}` : `/categories/${category.slug}?page=${pageNumber}`,
      isCurrent: pageNumber === currentPage,
    };
  });

  const pageSuffix = currentPage > 1 ? `?page=${currentPage}` : "";
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin, pageSuffix);
  const title = `${layout.siteName} | Category: ${category.name}`;
  const description = `Posts in ${category.name} on ${layout.siteName}.`;

  const bodyHtml = await renderThemeTemplate("category-archive", {
    ...layout,
    cspNonce,
    searchQuery: "",
    category,
    latestStories,
    pagination: { currentPage, totalPages, totalItems: paginatedStories.totalItems, pages: paginationPages, hasPagination: totalPages > 1 },
    currentYear: new Date().getFullYear(),
  });

  const html = buildHtmlDocument({
    title,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({ title, description, canonicalUrl: publicUrl }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, 200, cspNonce);
}

async function renderAuthorArchive(pathname: string, publicOrigin: string, authorSlug: string, requestedPage: number): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const author = await getUserBySlug(authorSlug);
  if (!author) return renderErrorPage(404, pathname, publicOrigin);

  const paginatedStories = await getPaginatedPosts({ perPage: 20, page: requestedPage, sticky: false, author: author.id });
  if (paginatedStories.totalPages > 0 && requestedPage > paginatedStories.totalPages) return renderErrorPage(404, pathname, publicOrigin);

  const currentPage = requestedPage;
  const totalPages = paginatedStories.totalPages;
  const latestStories = paginatedStories.posts;
  const paginationPages = Array.from({ length: totalPages }, (_, idx) => {
    const pageNumber = idx + 1;
    return { number: pageNumber, href: pageNumber === 1 ? `/author/${author.slug}` : `/author/${author.slug}?page=${pageNumber}`, isCurrent: pageNumber === currentPage };
  });

  const pageSuffix = currentPage > 1 ? `?page=${currentPage}` : "";
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin, pageSuffix);
  const title = `${layout.siteName} | Author: ${author.name}`;
  const description = `Posts by ${author.name} on ${layout.siteName}.`;

  const bodyHtml = await renderThemeTemplate("author-archive", {
    ...layout,
    cspNonce,
    searchQuery: "",
    author,
    latestStories,
    pagination: { currentPage, totalPages, totalItems: paginatedStories.totalItems, pages: paginationPages, hasPagination: totalPages > 1 },
    currentYear: new Date().getFullYear(),
  });

  const html = buildHtmlDocument({
    title,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({ title, description, canonicalUrl: publicUrl }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, 200, cspNonce);
}

async function renderPage(pathname: string, page: PageViewModel, templateName: string, publicOrigin: string): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin);
  const description = trimTo160(page.excerptText || page.title);

  const bodyHtml = await renderThemeTemplate(templateName, {
    ...layout,
    cspNonce,
    searchQuery: "",
    page,
    currentYear: new Date().getFullYear(),
  });

  const html = buildHtmlDocument({
    title: page.title,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({ title: page.title, description, canonicalUrl: publicUrl }),
      buildCommonJsonLdHead({
        siteName: layout.siteName,
        title: page.title,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, 200, cspNonce);
}

async function renderPost(pathname: string, post: PostViewModel, publicOrigin: string): Promise<NextResponse> {
  const theme = await loadThemeTokens(getEnv().THEME);
  const themeName = getEnv().THEME;
  const layout = await getLayoutContext(theme.siteName);
  const cspNonce = createCspNonce();
  const customHeadHtml = await getCustomHeadHtml(themeName, cspNonce);
  const publicUrl = toAbsoluteUrl(pathname, publicOrigin);

  const primaryCategoryId = post.categories[0]?.id;
  let relatedPosts: PostViewModel[] = [];

  if (primaryCategoryId) {
    relatedPosts = await getPosts({ perPage: 8, categories: [primaryCategoryId], exclude: [post.id], sticky: false });
  }

  if (relatedPosts.length < 4) {
    const recentFallback = await getPosts({ perPage: 12, exclude: [post.id], sticky: false });
    const merged = [...relatedPosts];
    for (const candidate of recentFallback) {
      if (merged.some((item) => item.id === candidate.id)) continue;
      merged.push(candidate);
      if (merged.length >= 4) break;
    }
    relatedPosts = merged;
  }

  relatedPosts = relatedPosts.slice(0, 4);
  const { contentHtmlWithIds, tocItems } = buildTocAndInjectHeadingIds(post.contentHtml ?? "");
  const { leadHtml: postLeadHtml, remainingHtml: postRemainingHtml } = splitAfterFirstParagraph(contentHtmlWithIds);
  const encodedUrl = encodeURIComponent(publicUrl);
  const encodedTitle = encodeURIComponent(post.title);
  const encodedShareText = encodeURIComponent(`${post.title} ${publicUrl}`);
  const shareLinks = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, icon: layout.icons.facebook, external: true },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, icon: layout.icons.linkedin, external: true },
    { label: "Email", href: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${post.title}\n\n${publicUrl}`)}`, icon: layout.icons.email, external: false },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedShareText}`, icon: layout.icons.whatsapp, external: true },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, icon: layout.icons.telegram, external: true },
    { label: "SMS", href: `sms:?body=${encodedShareText}`, icon: layout.icons.sms, external: false },
  ];

  const bodyHtml = await renderThemeTemplate("post", {
    ...layout,
    cspNonce,
    searchQuery: "",
    post,
    postLeadHtml,
    postRemainingHtml,
    tocItems,
    shareLinks,
    postMetaTags: post.tags,
    relatedPosts,
    currentYear: new Date().getFullYear(),
  });

  const description = trimTo160(post.excerptText160 || post.excerptText || post.title);
  const html = buildHtmlDocument({
    title: post.title,
    description,
    canonicalUrl: publicUrl,
    headHtml: [
      buildSocialHead({
        title: post.title,
        description,
        canonicalUrl: publicUrl,
        type: "article",
        image: post.featuredImage
          ? { url: post.featuredImage.url, width: post.featuredImage.width, height: post.featuredImage.height }
          : null,
      }),
      buildPostJsonLdHead({
        siteName: layout.siteName,
        post,
        description,
        canonicalUrl: publicUrl,
        pathname,
        publicOrigin,
        nonce: cspNonce,
        logoPath: theme.logoPath,
      }),
      customHeadHtml,
    ]
      .filter(Boolean)
      .join("\n"),
    themeStyleBlock: buildThemeStyleBlock(theme),
    bodyHtml,
    htmlDir: resolveHtmlDirection(theme),
    faviconHref: resolveFaviconHref(theme),
    cspNonce,
  });

  return htmlResponse(html, 200, cspNonce);
}

export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }): Promise<Response> {
  const requestUrl = new URL(request.url);
  const { slug = [] } = await context.params;
  const pathname = `/${slug.join("/")}`.replace(/\/+/g, "/") || "/";
  const publicOrigin = getPublicOrigin(request);

  const redirect = await resolveRedirect(pathname);
  if (redirect?.type === "redirect") {
    const redirectUrl = new URL(redirect.to, publicOrigin);
    if (redirectUrl.origin !== publicOrigin) {
      return new NextResponse("External redirects are not allowed", { status: 400 });
    }
    return NextResponse.redirect(redirectUrl, redirect.status);
  }
  if (redirect?.type === "gone") {
    return renderErrorPage(410, pathname, publicOrigin);
  }

  if (slug.length === 0) {
    const page = toPositiveInt(requestUrl.searchParams.get("page"), 1);
    return renderHome(pathname, publicOrigin, page);
  }

  const slugTail = lastSlug(slug);

  if (slugTail === "search" && slug.length === 1) {
    return renderSearch(pathname, publicOrigin, requestUrl.searchParams.get("q") ?? "");
  }

  if (slugTail === "articles" && slug.length === 1) {
    const page = toPositiveInt(requestUrl.searchParams.get("page"), 1);
    return renderArticles(pathname, publicOrigin, page);
  }

  if (slugTail === "categories" && slug.length === 1) {
    return renderCategories(pathname, publicOrigin);
  }

  if (slug[0] === "categories" && slug.length === 2) {
    const page = toPositiveInt(requestUrl.searchParams.get("page"), 1);
    return renderCategoryArchive(pathname, publicOrigin, slug[1], page);
  }

  if (slug[0] === "tag" && slug.length === 2) {
    const page = toPositiveInt(requestUrl.searchParams.get("page"), 1);
    return renderTagArchive(pathname, publicOrigin, slug[1], page);
  }

  if (slug[0] === "author" && slug.length === 2) {
    const page = toPositiveInt(requestUrl.searchParams.get("page"), 1);
    return renderAuthorArchive(pathname, publicOrigin, slug[1], page);
  }

  if (slug.length !== 1) {
    return renderErrorPage(404, pathname, publicOrigin);
  }

  const template = templateForPageSlug(slugTail);
  if (template) {
    const page = await getPageBySlug(slugTail);
    if (!page) return renderErrorPage(404, pathname, publicOrigin);
    return renderPage(pathname, page, template, publicOrigin);
  }

  const post = await getPostBySlug(slugTail);
  if (post) return renderPost(pathname, post, publicOrigin);

  const page = await getPageBySlug(slugTail);
  if (page) return renderPage(pathname, page, "page", publicOrigin);

  return renderErrorPage(404, pathname, publicOrigin);
}
