import "server-only";

import { toCachedMediaUrl } from "@/lib/media/cache-url";
import { sanitizeWpHtml } from "@/lib/security/sanitize";
import type { PageViewModel, PostViewModel, WpFeaturedMedia, WpPage, WpPost, WpTerm } from "@/types/wp";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(input: string): string {
  const noTags = input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return decodeHtmlEntities(noTags);
}

function toExcerptText(html: string | undefined, maxLength: number = 180): string {
  const plain = stripHtml(html ?? "");
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength).trimEnd()}...`;
}

function demoteH1ToH2(html: string | undefined): string | undefined {
  if (!html) {
    return html;
  }
  return html.replace(/<h1\b/gi, "<h2").replace(/<\/h1>/gi, "</h2>");
}

function rewriteWpImageSourcesToCache(html: string | undefined): string | undefined {
  if (!html) return html;

  return html.replace(/<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi, (tag, quote: string, src: string) => {
    const cachedSrc = toCachedMediaUrl(src);
    if (cachedSrc === src) return tag;
    return tag.replace(`src=${quote}${src}${quote}`, `src=${quote}${cachedSrc}${quote}`);
  });
}

function getFeaturedMedia(post: WpPost | WpPage): WpFeaturedMedia | null {
  return post._embedded?.["wp:featuredmedia"]?.[0] ?? null;
}

function getTerms(post: WpPost): { categories: WpTerm[]; tags: WpTerm[] } {
  const termGroups = post._embedded?.["wp:term"] ?? [];
  const allTerms = termGroups.flat();

  return {
    categories: allTerms.filter((term) => term.taxonomy === "category"),
    tags: allTerms.filter((term) => term.taxonomy === "post_tag"),
  };
}

export function mapWpPostToViewModel(post: WpPost): PostViewModel {
  const featured = getFeaturedMedia(post);
  const author = post._embedded?.author?.[0];
  const terms = getTerms(post);
  const publishedDate = new Date(post.date);
  const publishedAtFormatted = Number.isNaN(publishedDate.getTime())
    ? post.date
    : publishedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
  const publishedTimeFormatted = Number.isNaN(publishedDate.getTime())
    ? ""
    : publishedDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

  const sanitizedContentHtml = sanitizeWpHtml(post.content?.rendered);
  const contentHtml = rewriteWpImageSourcesToCache(demoteH1ToH2(sanitizedContentHtml));

  return {
    id: post.id,
    slug: post.slug,
    title: stripHtml(post.title.rendered),
    excerptText: toExcerptText(post.excerpt.rendered),
    excerptText160: toExcerptText(post.excerpt.rendered, 160),
    contentHtml,
    publishedAt: post.date,
    publishedAtFormatted,
    publishedTimeFormatted,
    link: post.link,
    primaryCategoryName: terms.categories[0]?.name ?? "General",
    author: {
      name: author?.name ?? "Editorial Team",
      slug: author?.slug ?? "editorial-team",
    },
    featuredImage: featured?.source_url
      ? {
          url: toCachedMediaUrl(featured.source_url),
          width: featured.media_details?.width ?? null,
          height: featured.media_details?.height ?? null,
          alt: featured.alt_text ?? stripHtml(post.title.rendered),
        }
      : null,
    categories: terms.categories.map((term) => ({ id: term.id, name: term.name, slug: term.slug })),
    tags: terms.tags.map((term) => ({ id: term.id, name: term.name, slug: term.slug })),
  };
}

export function mapWpPageToViewModel(page: WpPage): PageViewModel {
  const sanitizedContentHtml = sanitizeWpHtml(page.content.rendered);

  return {
    id: page.id,
    slug: page.slug,
    title: stripHtml(page.title.rendered),
    excerptText: toExcerptText(page.excerpt?.rendered),
    contentHtml: rewriteWpImageSourcesToCache(sanitizedContentHtml),
    publishedAt: page.date,
    link: page.link,
  };
}
