export interface LanguageOption {
  id: string;
  label: string;
  detail: string;
}

/**
 * Languages offered on first launch and in Settings. The selection is a
 * workspace preference: it records what the user intends to write agents and
 * code in, and stays on this device.
 */
export const LANGUAGES: LanguageOption[] = [
  { id: "typescript", label: "TypeScript", detail: "agent scripts · .agent.ts" },
  { id: "javascript", label: "JavaScript", detail: "agents and tooling" },
  { id: "python", label: "Python", detail: "scripts and services" },
  { id: "rust", label: "Rust", detail: "native tools" },
  { id: "go", label: "Go", detail: "services and CLIs" },
];

const STORAGE_KEY = "acidmade.languages.v1";

function knownIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && LANGUAGES.some((language) => language.id === entry),
  );
  return [...new Set(ids)];
}

/** Null means the user has never chosen, which is what opens the first-run screen. */
export function loadLanguageSelection(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const ids = knownIds(parsed);
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export function saveLanguageSelection(ids: string[]): string[] {
  const selection = knownIds(ids);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      /* storage blocked · the selection still applies for this session */
    }
  }
  return selection;
}
