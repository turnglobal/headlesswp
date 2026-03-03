import "server-only";

import sanitizeHtml from "sanitize-html";

const YOUTUBE_HOST_PATTERN = /^(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)$/i;
const YOUTUBE_SHORT_HOST_PATTERN = /^youtu\.be$/i;
const VIMEO_HOST_PATTERN = /^(?:www\.)?vimeo\.com$/i;
const VIMEO_PLAYER_HOST_PATTERN = /^player\.vimeo\.com$/i;

function isAllowedIframeSrc(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    if (parsed.protocol !== "https:") return false;
    return (
      YOUTUBE_HOST_PATTERN.test(parsed.hostname) ||
      YOUTUBE_SHORT_HOST_PATTERN.test(parsed.hostname) ||
      VIMEO_HOST_PATTERN.test(parsed.hostname) ||
      VIMEO_PLAYER_HOST_PATTERN.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function sanitizeWpHtml(input: string | undefined): string {
  if (!input) return "";

  return sanitizeHtml(input, {
    allowedTags: [
      "p",
      "br",
      "hr",
      "blockquote",
      "pre",
      "code",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "dl",
      "dt",
      "dd",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "mark",
      "small",
      "a",
      "img",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "span",
      "div",
      "iframe",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "aria-label"],
      img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "loading", "decoding", "fetchpriority"],
      iframe: ["src", "title", "width", "height", "allow", "allowfullscreen", "loading", "referrerpolicy"],
      "*": ["class", "id", "aria-label", "aria-hidden", "role", "dir", "lang"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
      }),
    },
    exclusiveFilter(frame) {
      if (frame.tag !== "iframe") return false;
      const src = frame.attribs?.src ?? "";
      return !isAllowedIframeSrc(src);
    },
  });
}
