import type { NodeKind, SceneIconKey } from "../types";

export type CatalogTone = "ui" | "logic" | "agent";

export interface NodeClassDef {
  id: string;
  label: string;
  className: string;
  kind: NodeKind;
  icon: SceneIconKey;
  defaultName: string;
  description: string;
}

export interface CatalogGroup {
  id: string;
  label: string;
  hint: string;
  tone: CatalogTone;
  classes: NodeClassDef[];
}

export const NODE_CATALOG: CatalogGroup[] = [
  {
    id: "ui",
    label: "UI Nodes",
    hint: "Controls, containers and view scenes",
    tone: "ui",
    classes: [
      {
        id: "ui-component",
        label: "UIComponent",
        className: "UIComponent",
        kind: "ui",
        icon: "control",
        defaultName: "NewControl",
        description: "A reusable interface control with a mount lifecycle and local signals.",
      },
      {
        id: "layout-container",
        label: "LayoutContainer",
        className: "LayoutContainer",
        kind: "ui",
        icon: "layout",
        defaultName: "NewContainer",
        description: "Flex-based layout container that arranges child view nodes.",
      },
      {
        id: "view-scene",
        label: "ViewScene",
        className: "ViewScene",
        kind: "ui",
        icon: "view",
        defaultName: "NewView",
        description: "A routable scene surface with its own contract and agent overlay.",
      },
      {
        id: "data-widget",
        label: "DataWidget",
        className: "DataWidget",
        kind: "ui",
        icon: "widget",
        defaultName: "NewWidget",
        description: "A data-bound widget that subscribes to API or agent signals.",
      },
      {
        id: "route-guard",
        label: "RouteGuard",
        className: "RouteGuard",
        kind: "ui",
        icon: "guard",
        defaultName: "NewGuard",
        description: "Gates a scene subtree behind authentication or policy checks.",
      },
      {
        id: "navbar",
        label: "TopBar",
        className: "TopBar",
        kind: "ui",
        icon: "navbar",
        defaultName: "NewNavbar",
        description: "A persistent navigation surface for commands and project context.",
      },
    ],
  },
  {
    id: "logic",
    label: "Data & API Nodes",
    hint: "Endpoints, streams and persistent stores",
    tone: "logic",
    classes: [
      {
        id: "edge-endpoint",
        label: "EdgeEndpoint",
        className: "EdgeEndpoint",
        kind: "api",
        icon: "api",
        defaultName: "NewEndpoint",
        description: "An edge runtime handler that emits typed payload signals.",
      },
      {
        id: "api-route",
        label: "APIRoute",
        className: "APIRoute",
        kind: "api",
        icon: "api",
        defaultName: "NewRoute",
        description: "A typed request/response route mounted under res://api.",
      },
      {
        id: "data-store",
        label: "DataStore",
        className: "DataStore",
        kind: "data",
        icon: "data",
        defaultName: "NewStore",
        description: "A persistent relational store with a generated schema contract.",
      },
      {
        id: "realtime-stream",
        label: "RealtimeStream",
        className: "RealtimeStream",
        kind: "api",
        icon: "api",
        defaultName: "NewStream",
        description: "A WebSocket or SSE channel that hydrates agent telemetry.",
      },
    ],
  },
  {
    id: "agents",
    label: "Super-Agent Nodes",
    hint: "Autonomous workers with tools and memory",
    tone: "agent",
    classes: [
      {
        id: "autonomous-agent",
        label: "AutonomousAgent",
        className: "AutonomousAgent",
        kind: "agent",
        icon: "agent",
        defaultName: "NewAgent",
        description: "A full-acid worker that plans, calls tools and self-heals its scene.",
      },
      {
        id: "reviewer-agent",
        label: "ReviewerAgent",
        className: "ReviewerAgent",
        kind: "agent",
        icon: "agent",
        defaultName: "Reviewer",
        description: "Reviews generated diffs and blocks regressions before export.",
      },
      {
        id: "scaffolder-agent",
        label: "ScaffolderAgent",
        className: "ScaffolderAgent",
        kind: "agent",
        icon: "agent",
        defaultName: "Scaffolder",
        description: "Creates new nodes, resource files and signal wiring on request.",
      },
      {
        id: "ops-agent",
        label: "OpsAgent",
        className: "OpsAgent",
        kind: "agent",
        icon: "agent",
        defaultName: "OpsAgent",
        description: "Monitors runtime health, deployments and stream saturation.",
      },
    ],
  },
];

export function catalogClass(id: string): NodeClassDef | null {
  for (const group of NODE_CATALOG) {
    const match = group.classes.find((item) => item.id === id);
    if (match) return match;
  }
  return null;
}
