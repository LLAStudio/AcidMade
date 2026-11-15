export interface Project {
  id: string;
  name: string;
  slug: string;
  branch: string;
  environment: string;
  path?: string;
  summary?: string;
  scene?: string;
  template?: string;
  updated?: string;
  pinned?: boolean;
  custom?: boolean;
}

export const PROJECTS: Project[] = [
  {
    id: "northwind",
    name: "Northwind Analytics",
    slug: "northwind-analytics",
    branch: "main",
    environment: "Preview",
    path: "~/AcidMade/northwind-analytics",
    summary:
      "Agent-driven analytics workspace. A dashboard scene, a streaming edge endpoint and two super-agents wired through signals.",
    scene: "res://scenes/MainApp.acid",
    template: "Analytics dashboard",
    updated: "2 minutes ago",
    pinned: true,
  },
  {
    id: "flux",
    name: "Flux Console",
    slug: "flux-console",
    branch: "feat/agent-mesh",
    environment: "Staging",
    path: "~/AcidMade/flux-console",
    summary:
      "Multi-agent mesh experiment. Three collaborating agents share one scene graph and a shared signal bus.",
    scene: "res://scenes/MainApp.acid",
    template: "Agent workspace",
    updated: "yesterday",
  },
  {
    id: "acid-core",
    name: "AcidMade Core",
    slug: "acidmade-core",
    branch: "main",
    environment: "Local",
    path: "~/AcidMade/acidmade-core",
    summary:
      "The engine's own workspace. Holds the reference scene, the resource catalogue and the docs console.",
    scene: "res://scenes/MainApp.acid",
    template: "Blank scene",
    updated: "3 days ago",
  },
];

export const DEFAULT_PROJECT = PROJECTS[0];

export interface ProjectTemplate {
  id: string;
  name: string;
  summary: string;
  scene: string;
  nodes: number;
  agents: number;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "dashboard",
    name: "Analytics dashboard",
    summary: "Shell, page, metric grid, streaming endpoint and one analytics agent.",
    scene: "res://scenes/MainApp.acid",
    nodes: 9,
    agents: 2,
  },
  {
    id: "agent",
    name: "Agent workspace",
    summary: "Agent hub first. Two super-agents, a shared signal bus and no UI shell.",
    scene: "res://scenes/AgentMesh.acid",
    nodes: 5,
    agents: 3,
  },
  {
    id: "blank",
    name: "Blank scene",
    summary: "One root node and one script. Nothing else wired in.",
    scene: "res://scenes/MainApp.acid",
    nodes: 1,
    agents: 0,
  },
];

export function mergeProjects(extra: Project[] = []): Project[] {
  const seen = new Set<string>();
  const merged: Project[] = [];
  for (const project of [...PROJECTS, ...extra]) {
    if (!project?.id || seen.has(project.id)) continue;
    seen.add(project.id);
    merged.push(project);
  }
  return merged;
}
