import { CODE_FILES } from "../data/resources";
import { PROJECT_TEMPLATES, type Project } from "../data/projects";

export interface DiskProject {
  id: string;
  name: string;
  slug: string;
  branch: string;
  environment: string;
  path: string;
  scene: string;
  template: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
}

export interface ProjectFileInfo {
  path: string;
  name: string;
  kind?: "file" | "dir";
  size: number;
  mtime?: string;
  language: string;
}

export interface ProjectFileContent {
  content: string;
  size: number;
  mtime: string;
  language: string;
}

export interface CreateProjectInput {
  name: string;
  template?: string;
}

interface ProjectsBridge {
  list(): Promise<{ root: string; projects: DiskProject[] }>;
  create(input: CreateProjectInput): Promise<DiskProject>;
  openDialog(): Promise<DiskProject | null>;
  openPath(projectPath: string): Promise<DiskProject>;
  takePending(): Promise<string | null>;
  markReady(): Promise<boolean>;
  onOpenFile(callback: (projectPath: string) => void): () => void;
  reveal(projectPath: string): Promise<void>;
  tree(projectPath: string): Promise<ProjectFileInfo[]>;
  readFile(projectPath: string, relative: string): Promise<ProjectFileContent>;
  writeFile(
    projectPath: string,
    relative: string,
    content: string,
  ): Promise<{ size: number; mtime: string }>;
  createEntry(
    projectPath: string,
    relative: string,
    kind: "file" | "dir",
  ): Promise<{ path: string; kind: "file" | "dir" }>;
  renameEntry(projectPath: string, from: string, to: string): Promise<{ path: string }>;
  duplicateEntry(projectPath: string, relative: string): Promise<{ path: string; entries?: number }>;
  deleteEntry(projectPath: string, relative: string): Promise<{ path: string; removed?: number }>;
  renameProject(projectPath: string, name: string): Promise<DiskProject>;
  duplicateProject(projectPath: string): Promise<DiskProject>;
  deleteProject(projectPath: string): Promise<{ path: string }>;
}

interface DesktopBridge {
  runtimeUrl?: string;
  platform?: string;
  projects?: ProjectsBridge;
}

function bridge(): DesktopBridge | undefined {
  return (globalThis as { acidmade?: DesktopBridge }).acidmade;
}

export function projectsBridge(): ProjectsBridge | undefined {
  return bridge()?.projects;
}

export const isDiskBacked = (): boolean => Boolean(projectsBridge());

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled-project"
  );
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "unknown";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + " h ago";
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return days + " days ago";
  return new Date(then).toISOString().slice(0, 10);
}

export function toProject(record: DiskProject): Project {
  return {
    id: record.slug,
    name: record.name,
    slug: record.slug,
    branch: record.branch,
    environment: record.environment,
    path: record.path,
    summary: record.summary,
    scene: record.scene,
    template: record.template,
    updated: relativeTime(record.updatedAt),
    custom: true,
  };
}

export interface ProjectListResult {
  root: string;
  projects: Project[];
  diskBacked: boolean;
}

export async function listProjects(): Promise<ProjectListResult> {
  const api = projectsBridge();
  if (!api) {
    return { root: "res:// (browser preview)", projects: [], diskBacked: false };
  }
  const result = await api.list();
  return {
    root: result.root,
    projects: result.projects.map(toProject),
    diskBacked: true,
  };
}

export async function createProjectOnDisk(input: CreateProjectInput): Promise<Project> {
  const api = projectsBridge();
  const template = PROJECT_TEMPLATES.find((entry) => entry.id === (input.template ?? "dashboard"))
    ?? PROJECT_TEMPLATES[0];
  const slug = slugify(input.name);

  if (api) {
    return toProject(await api.create({ name: input.name, template: template.id }));
  }

  // Browser preview: no filesystem access, so the project lives in the
  // launcher snapshot instead. Editing files stays disabled in that mode.
  return {
    id: "local-" + slug,
    name: input.name.trim(),
    slug,
    branch: "main",
    environment: "Local",
    path: "~/AcidMade/" + slug,
    summary: template.summary,
    scene: template.scene,
    template: template.name,
    updated: "just now",
    custom: true,
  };
}

export async function openProjectFile(): Promise<Project | null> {
  const api = projectsBridge();
  if (!api) return null;
  const record = await api.openDialog();
  return record ? toProject(record) : null;
}

export async function openProjectByPath(projectPath: string): Promise<Project> {
  const api = projectsBridge();
  if (!api) throw new Error("opening a project file requires the desktop app");
  return toProject(await api.openPath(projectPath));
}

/** A .acm opened before the window existed, consumed once at startup. */
export async function takePendingProject(): Promise<string | null> {
  const api = projectsBridge();
  if (!api) return null;
  return api.takePending();
}

export function markProjectBridgeReady(): void {
  void projectsBridge()?.markReady();
}

export function onProjectFileOpen(callback: (projectPath: string) => void): () => void {
  const api = projectsBridge();
  if (!api) return () => {};
  return api.onOpenFile(callback);
}

export async function renameProject(project: Project, name: string): Promise<Project> {
  const api = projectsBridge();
  if (!api || !project.path) throw new Error("renaming a project requires the desktop app");
  return toProject(await api.renameProject(project.path, name));
}

export async function duplicateProject(project: Project): Promise<Project> {
  const api = projectsBridge();
  if (!api || !project.path) throw new Error("duplicating a project requires the desktop app");
  return toProject(await api.duplicateProject(project.path));
}

export async function deleteProject(project: Project): Promise<{ path: string }> {
  const api = projectsBridge();
  if (!api || !project.path) throw new Error("deleting a project requires the desktop app");
  return api.deleteProject(project.path);
}

export async function revealProject(project: Project): Promise<boolean> {
  const api = projectsBridge();
  if (!api || !project.path) return false;
  await api.reveal(project.path);
  return true;
}

export async function projectFiles(project: Project): Promise<ProjectFileInfo[]> {
  const api = projectsBridge();
  if (api && project.path) return api.tree(project.path);

  return CODE_FILES.map((file) => ({
    path: file.path,
    name: file.name,
    size: file.content.length,
    language: file.language,
  }));
}

export async function readProjectFile(
  project: Project,
  relative: string,
): Promise<ProjectFileContent> {
  const api = projectsBridge();
  if (api && project.path) return api.readFile(project.path, relative);

  const file = CODE_FILES.find((entry) => entry.path === relative);
  if (!file) throw new Error("resource not found in the browser catalogue");
  return {
    content: file.content,
    size: file.content.length,
    mtime: new Date().toISOString(),
    language: file.language,
  };
}

export async function writeProjectFile(
  project: Project,
  relative: string,
  content: string,
): Promise<{ size: number; mtime: string }> {
  const api = projectsBridge();
  if (!api || !project.path) {
    throw new Error("editing resources requires the desktop app");
  }
  return api.writeFile(project.path, relative, content);
}

function requireDisk(project: Project): { api: ProjectsBridge; path: string } {
  const api = projectsBridge();
  if (!api || !project.path) {
    throw new Error("managing resources requires the desktop app");
  }
  return { api, path: project.path };
}

export async function createProjectEntry(
  project: Project,
  relative: string,
  kind: "file" | "dir",
): Promise<{ path: string; kind: "file" | "dir" }> {
  const { api, path } = requireDisk(project);
  return api.createEntry(path, relative, kind);
}

export async function renameProjectEntry(
  project: Project,
  from: string,
  to: string,
): Promise<{ path: string }> {
  const { api, path } = requireDisk(project);
  return api.renameEntry(path, from, to);
}

export async function duplicateProjectEntry(
  project: Project,
  relative: string,
): Promise<{ path: string; entries?: number }> {
  const { api, path } = requireDisk(project);
  return api.duplicateEntry(path, relative);
}

export async function deleteProjectEntry(
  project: Project,
  relative: string,
): Promise<{ path: string; removed?: number }> {
  const { api, path } = requireDisk(project);
  return api.deleteEntry(path, relative);
}
