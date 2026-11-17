import { APP_VERSION } from "./version";

export interface ReleaseInfo {
  version: string;
  url: string;
}

interface ReleasePayload {
  tag?: string;
  url?: string;
}

interface UpdatesBridge {
  latest(): Promise<ReleasePayload | null>;
}

interface DesktopBridge {
  updates?: UpdatesBridge;
}

const DISMISS_KEY = "acidmade.update-dismissed.v1";
const CACHE_KEY = "acidmade.update-check.v1";
const CACHE_MS = 6 * 60 * 60 * 1000;
const RELEASE_API = "https://api.github.com/repos/LLAStudio/AcidMade/releases/latest";

// Keeps hiding effective for this session even when localStorage is blocked.
const dismissedThisSession = new Set<string>();

function updatesBridge(): UpdatesBridge | undefined {
  return (globalThis as { acidmade?: DesktopBridge }).acidmade?.updates;
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, "").split(/[-+]/)[0];
}

function versionParts(value: string): number[] {
  const parts = normalizeVersion(value)
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** Only stable numeric versions are compared, newest first. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = versionParts(candidate);
  const active = versionParts(current);
  for (let index = 0; index < 3; index += 1) {
    if (next[index] !== active[index]) return next[index] > active[index];
  }
  return false;
}

function readDismissed(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

export function dismissUpdate(version: string): void {
  const normalized = normalizeVersion(version);
  dismissedThisSession.add(normalized);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, normalized);
  } catch {
    /* storage blocked · the notice can return on the next launch */
  }
}

interface CachedRelease {
  checkedAt: number;
  version: string;
  url: string;
}

function readCache(): CachedRelease | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<CachedRelease>;
    if (
      typeof candidate.checkedAt !== "number" ||
      typeof candidate.version !== "string" ||
      typeof candidate.url !== "string"
    ) {
      return null;
    }
    return {
      checkedAt: candidate.checkedAt,
      version: candidate.version,
      url: candidate.url,
    };
  } catch {
    return null;
  }
}

function writeCache(release: CachedRelease): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(release));
  } catch {
    /* storage blocked · the check simply runs again next launch */
  }
}

function decide(version: string, url: string): ReleaseInfo | null {
  const normalized = normalizeVersion(version);
  if (!normalized || !/^https:\/\//.test(url)) return null;
  if (dismissedThisSession.has(normalized) || readDismissed() === normalized) return null;
  if (!isNewerVersion(normalized, APP_VERSION)) return null;
  return { version: normalized, url };
}

async function fetchLatestInBrowser(): Promise<ReleasePayload | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(RELEASE_API, {
      signal: controller.signal,
      headers: { accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { tag_name?: unknown; html_url?: unknown };
    if (typeof payload.tag_name !== "string" || typeof payload.html_url !== "string") return null;
    return { tag: payload.tag_name, url: payload.html_url };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Returns the newest release only when it is newer than this build and the user
 * has not hidden it. Every failure (offline, rate limit, no published release)
 * resolves to null so the launcher never waits on the network.
 */
export async function checkForUpdate(): Promise<ReleaseInfo | null> {
  const cached = readCache();
  if (cached && Date.now() - cached.checkedAt < CACHE_MS) {
    return decide(cached.version, cached.url);
  }

  let payload: ReleasePayload | null = null;
  try {
    const bridge = updatesBridge();
    payload = bridge ? await bridge.latest() : await fetchLatestInBrowser();
  } catch {
    return null;
  }

  if (!payload?.tag || !payload.url) return null;
  writeCache({
    checkedAt: Date.now(),
    version: normalizeVersion(payload.tag),
    url: payload.url,
  });
  return decide(payload.tag, payload.url);
}
