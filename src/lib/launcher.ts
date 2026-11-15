import type { Project } from "../data/projects";

const STORAGE_KEY = "acidmade.launcher.v1";

export interface LauncherSnapshot {
  projectId: string;
  projects: Project[];
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.slug === "string" &&
    typeof entry.branch === "string" &&
    typeof entry.environment === "string"
  );
}

export function loadLauncher(): LauncherSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LauncherSnapshot>;
    const projects = Array.isArray(parsed.projects)
      ? parsed.projects.filter(isProject).map((project) => ({ ...project, custom: true }))
      : [];
    return {
      projectId: typeof parsed.projectId === "string" ? parsed.projectId : "",
      projects,
    };
  } catch {
    return null;
  }
}

export function saveLauncher(snapshot: LauncherSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* storage full or blocked · launcher state is not critical */
  }
}
