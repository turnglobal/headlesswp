import "server-only";

const REQUIRED_KEYS = ["WP_DOMAIN", "WP_USERNAME", "WP_APP_PASSWORD"] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];

export type AppEnv = {
  DOMAIN?: string;
  WP_DOMAIN: string;
  WP_USERNAME: string;
  WP_APP_PASSWORD: string;
  THEME: string;
  CACHE_TTL_SECONDS: number;
};

let cachedEnv: AppEnv | null = null;

function requireEnv(key: RequiredKey): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function normalizeBaseUrl(value: string, key: string): string {
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    throw new Error(`Invalid URL in ${key}: ${value}`);
  }
}

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const ttlRaw = process.env.CACHE_TTL_SECONDS ?? "86400";
  const ttl = Number.parseInt(ttlRaw, 10);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error(`Invalid CACHE_TTL_SECONDS value: ${ttlRaw}`);
  }

  const normalizedDomain = process.env.DOMAIN?.trim() ? normalizeBaseUrl(process.env.DOMAIN.trim(), "DOMAIN") : undefined;
  if (process.env.NODE_ENV === "production" && !normalizedDomain) {
    throw new Error("DOMAIN is required in production for secure canonical URL generation.");
  }

  cachedEnv = {
    DOMAIN: normalizedDomain,
    WP_DOMAIN: normalizeBaseUrl(requireEnv("WP_DOMAIN"), "WP_DOMAIN"),
    WP_USERNAME: requireEnv("WP_USERNAME"),
    WP_APP_PASSWORD: requireEnv("WP_APP_PASSWORD"),
    THEME: (process.env.THEME ?? "default").trim() || "default",
    CACHE_TTL_SECONDS: ttl,
  };

  return cachedEnv;
}

export function getWpBasicAuthHeader(): string {
  const { WP_USERNAME, WP_APP_PASSWORD } = getEnv();
  const token = Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`, "utf8").toString("base64");
  return `Basic ${token}`;
}
