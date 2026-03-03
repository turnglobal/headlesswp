import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import type { ThemeTokens } from "@/types/theme";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadInlineTailwindCss(): string {
  try {
    const cssPath = path.join(process.cwd(), "public", "assets", "tailwind.css");
    return readFileSync(cssPath, "utf8").trim();
  } catch {
    return "";
  }
}

const INLINE_TAILWIND_CSS = loadInlineTailwindCss();

export function buildThemeStyleBlock(theme: ThemeTokens): string {
  const resolvedContentAlign = theme.contentAlign === "left" ? "left" : "justify";

  return `<style>
:root {
  --primary-color: ${theme.primaryColor};
  --link-color: ${theme.linkColor};
  --dark-bg: ${theme.darkBackground};
  --light-bg: ${theme.lightBackground};
  --text-color: ${theme.textColor};
  --muted-text-color: ${theme.mutedTextColor};
  --border-color: ${theme.borderColor};
  --bg-base: #ffffff;
  --bg-elevated: #fafafa;
  --text-strong: #111111;
  --text-muted: #4b5563;
  --line-soft: rgba(17, 17, 17, 0.12);
  --focus-ring: rgba(17, 17, 17, 0.92);
  --content-align: ${resolvedContentAlign};
}
html:not(.dark) {
  color-scheme: light;
  --primary-color: #111111;
  --link-color: #111111;
  --bg-base: #ffffff;
  --bg-elevated: #fafafa;
  --text-strong: #111111;
  --text-muted: #4b5563;
  --line-soft: rgba(17, 17, 17, 0.12);
  --focus-ring: rgba(17, 17, 17, 0.92);
}
html.dark {
  color-scheme: dark;
  --primary-color: #f5f5f5;
  --link-color: #f5f5f5;
  --bg-base: #000000;
  --bg-elevated: #111111;
  --text-strong: #f5f5f5;
  --text-muted: #d1d5db;
  --line-soft: rgba(245, 245, 245, 0.18);
  --focus-ring: rgba(245, 245, 245, 0.95);
}
* {
  font-style: normal !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
}
body {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(15px, 0.3vw + 14px, 17px);
  line-height: 1.55;
  font-weight: 400;
  background: var(--bg-base) !important;
  color: var(--text-strong) !important;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.theme-transition,
html,
body,
#smart-nav,
a,
button,
input,
textarea,
select,
[class*="bg-"],
[class*="text-"],
[class*="border-"],
.surface-muted,
.text-muted,
.line-soft,
.line-soft-top,
.line-soft-bottom,
.line-soft-left,
.line-soft-right,
svg {
  transition-property: background-color, color, border-color, fill, stroke, box-shadow, opacity;
  transition-duration: 360ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
#smart-nav {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(255, 255, 255, 0.94) !important;
}
html.dark #smart-nav {
  background: rgba(0, 0, 0, 0.94) !important;
}
.header-hidden {
  transform: translateY(-100%) !important;
}
.skip-link {
  position: absolute;
  left: 1rem;
  top: -5rem;
  z-index: 999;
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid var(--line-soft);
  background: var(--bg-base);
  color: var(--text-strong);
}
.skip-link:focus {
  top: 1rem;
}
.swiper-slide {
  transition: all 0.6s ease;
  opacity: 0.3;
  transform: scale(0.9);
}
.swiper-slide-active {
  opacity: 1;
  transform: scale(1);
}
.swiper-pagination-bullet-active {
  width: 24px !important;
  border-radius: 2px !important;
  background: var(--primary-color) !important;
}
.text-primary { color: var(--primary-color); }
.text-muted { color: var(--text-muted) !important; }
.surface-muted { background: var(--bg-elevated) !important; }
a {
  color: var(--link-color);
  text-underline-offset: 0.14em;
  text-decoration-thickness: 0.06em;
}
.line-soft { border: 0.75px solid var(--line-soft); }
.line-soft-top { border-top: 0.75px solid var(--line-soft); }
.line-soft-bottom { border-bottom: 0.75px solid var(--line-soft); }
.line-soft-left { border-left: 0.75px solid var(--line-soft); }
.line-soft-right { border-right: 0.75px solid var(--line-soft); }
.content-flow p,
.content-flow li {
  text-align: var(--content-align);
}
.content-flow :is(h1, h2, h3, h4, h5, h6) {
  text-align: start;
}
.content-flow :is(ul, ol) {
  padding-inline-start: 1.5rem;
}
.toc-chevron {
  transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
details[open] > summary .toc-chevron {
  transform: rotate(180deg);
}
summary::-webkit-details-marker {
  display: none;
}
main[id="main-content"] {
  scroll-margin-top: 6.5rem;
}
[class*="border-"] {
  border-color: var(--line-soft) !important;
}
:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transition-property: none !important;
    scroll-behavior: auto !important;
  }
}
</style>`;
}

export function buildTailwindHeadAssets(cspNonce?: string, includeSwiperCss: boolean = false): string {
  const nonceAttr = cspNonce ? ` nonce="${escapeHtml(cspNonce)}"` : "";
  const tags = [
    `<script${nonceAttr}>`,
    "(function () {",
    "  try {",
    "    var key = \"theme-override\";",
    "    var saved = sessionStorage.getItem(key);",
    "    var isDark = saved ? saved === \"dark\" : (window.matchMedia && window.matchMedia(\"(prefers-color-scheme: dark)\").matches);",
    "    document.documentElement.classList.toggle(\"dark\", !!isDark);",
    "  } catch (_err) {",
    "    var fallbackDark = window.matchMedia && window.matchMedia(\"(prefers-color-scheme: dark)\").matches;",
    "    document.documentElement.classList.toggle(\"dark\", !!fallbackDark);",
    "  }",
    "})();",
    "</script>",
    `<script${nonceAttr}>`,
    "console.info(\"This is an open source project created by Chandima Galahitiyawa, funded by Turn Global.\");",
    "console.info(\"GitHub: https://github.com/turnglobal/headlesswp - If it helps you, please give it a star / donation for more contributions. Make a copy for you.\");",
    "</script>",
  ];

  if (INLINE_TAILWIND_CSS) {
    tags.push(`<style${nonceAttr}>${INLINE_TAILWIND_CSS}</style>`);
  } else {
    tags.push('<link rel="preload" href="/assets/tailwind.css" as="style">');
    tags.push('<link rel="stylesheet" href="/assets/tailwind.css" media="print" onload="this.media=\'all\'">');
    tags.push('<noscript><link rel="stylesheet" href="/assets/tailwind.css"></noscript>');
  }

  if (includeSwiperCss) {
    tags.push('<link rel="preload" href="/assets/swiper-bundle.min.css" as="style">');
    tags.push('<link rel="stylesheet" href="/assets/swiper-bundle.min.css">');
  }

  return tags.join("\n");
}

export function buildBaseMeta(title: string, description: string, canonicalUrl: string, faviconHref: string): string {
  return [
    "<meta charset=\"UTF-8\">",
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name=\"description\" content=\"${escapeHtml(description)}\">`,
    `<link rel=\"canonical\" href=\"${escapeHtml(canonicalUrl)}\">`,
    `<link rel=\"icon\" href=\"${escapeHtml(faviconHref)}\">`,
  ].join("\n");
}

export function buildHtmlDocument(params: {
  title: string;
  description: string;
  canonicalUrl: string;
  headHtml: string;
  themeStyleBlock: string;
  bodyHtml: string;
  htmlDir?: "ltr" | "rtl";
  faviconHref?: string;
  cspNonce?: string;
  includeSwiperCss?: boolean;
}): string {
  const { title, description, canonicalUrl, headHtml, themeStyleBlock, bodyHtml, htmlDir, faviconHref, cspNonce, includeSwiperCss } = params;
  const dir = htmlDir === "rtl" ? "rtl" : "ltr";
  const resolvedFaviconHref = faviconHref && faviconHref.trim() ? faviconHref.trim() : "/favicon.ico";

  return `<!DOCTYPE html>
<html lang="en" dir="${dir}" class="scroll-smooth">
<head>
${buildBaseMeta(title, description, canonicalUrl, resolvedFaviconHref)}
${themeStyleBlock}
${buildTailwindHeadAssets(cspNonce, includeSwiperCss)}
${headHtml}
</head>
<body class="bg-white text-black dark:bg-black dark:text-white transition-colors duration-300 font-sans">
${bodyHtml}
</body>
</html>`;
}
