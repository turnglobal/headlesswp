import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import Handlebars from "handlebars";
import { getEnv } from "@/lib/config/env";
import type { ThemeTokens } from "@/types/theme";

const DEFAULT_SITE_NAME = "my-site";

function themeBasePath(themeName: string): string {
  return path.join(process.cwd(), "themes", themeName);
}

function stripJsonComments(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

type ThemeConfigSections = {
  settings?: {
    siteName?: string;
    logoPath?: string;
    faviconPath?: string;
    tocDefaultOpen?: boolean;
    contentAlign?: "justify" | "left";
    direction?: "ltr" | "rtl";
  };
  styles?: {
    primaryColor?: string;
    linkColor?: string;
    darkBackground?: string;
    lightBackground?: string;
    textColor?: string;
    mutedTextColor?: string;
    borderColor?: string;
  };
} & Partial<ThemeTokens>;

export async function loadThemeTokens(themeName: string): Promise<ThemeTokens> {
  const configPath = path.join(themeBasePath(themeName), "config.txs");
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(stripJsonComments(raw)) as ThemeConfigSections;
  const settings = parsed.settings ?? {};
  const styles = parsed.styles ?? {};

  return {
    siteName: settings.siteName ?? parsed.siteName,
    logoPath: settings.logoPath ?? parsed.logoPath,
    faviconPath: settings.faviconPath ?? parsed.faviconPath,
    tocDefaultOpen: true,
    contentAlign: "justify",
    direction: "ltr",
    ...settings,
    primaryColor: styles.primaryColor ?? parsed.primaryColor ?? "#f97316",
    linkColor: styles.linkColor ?? parsed.linkColor ?? "#0f766e",
    darkBackground: styles.darkBackground ?? parsed.darkBackground ?? "#0a0a0a",
    lightBackground: styles.lightBackground ?? parsed.lightBackground ?? "#ffffff",
    textColor: styles.textColor ?? parsed.textColor ?? "#111827",
    mutedTextColor: styles.mutedTextColor ?? parsed.mutedTextColor ?? "#6b7280",
    borderColor: styles.borderColor ?? parsed.borderColor ?? "#e5e7eb",
  };
}

async function registerPartials(hbs: typeof Handlebars, themeName: string): Promise<void> {
  const componentsPath = path.join(themeBasePath(themeName), "components");
  const files = await readdir(componentsPath);

  await Promise.all(
    files
      .filter((file) => file.endsWith(".txs"))
      .map(async (file) => {
        const partialName = file.replace(/\.txs$/, "");
        const source = await readFile(path.join(componentsPath, file), "utf8");
        hbs.registerPartial(partialName, source);
      }),
  );
}

export async function renderThemeTemplate(templateName: string, context: Record<string, unknown>): Promise<string> {
  const { THEME } = getEnv();
  const themeName = THEME || "default";
  const hbs = Handlebars.create();

  await registerPartials(hbs, themeName);

  const templatePath = path.join(themeBasePath(themeName), `${templateName}.txs`);
  const source = await readFile(templatePath, "utf8");
  const template = hbs.compile(source);
  const tokens = await loadThemeTokens(themeName);
  const siteNameOverride =
    typeof context.siteName === "string" && context.siteName.trim() !== "" ? context.siteName.trim() : undefined;
  const resolvedSiteName = siteNameOverride ?? tokens.siteName ?? DEFAULT_SITE_NAME;

  return template({
    ...context,
    theme: {
      ...tokens,
      siteName: resolvedSiteName,
    },
  });
}

export async function loadThemeHeadScripts(themeName: string): Promise<string> {
  try {
    const headerScriptsPath = path.join(themeBasePath(themeName), "header.txs");
    const source = await readFile(headerScriptsPath, "utf8");
    return source.trim();
  } catch {
    return "";
  }
}
