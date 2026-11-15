import type { NodeStatus, SceneNode, SignalDefinition } from "../types";

const signal = (
  id: string,
  name: string,
  args: string,
  description: string,
  connections: SignalDefinition["connections"],
): SignalDefinition => ({ id, name, args, description, connections });

export const SCENE_TREE: SceneNode = {
  id: "main-app",
  name: "MainApp",
  className: "AppRoot",
  kind: "root",
  icon: "root",
  summary: "Application root · mounts the workspace shell and owns the scene lifecycle.",
  status: "idle",
  visible: true,
  file: "scenes/MainApp.acid",
  script: "res://scenes/MainApp.acid",
  signals: [
    signal("main-ready", "on_ready", "()", "Emitted after the root scene finishes mounting.", [
      { nodeId: "workspace-shell", method: "mount" },
    ]),
  ],
  children: [
    {
      id: "auth-gate",
      name: "AuthGate",
      className: "RouteGuard",
      kind: "ui",
      icon: "guard",
      summary: "Route guard that gates the workspace behind an authenticated session.",
      status: "idle",
      visible: true,
      file: "scenes/AuthGate.acid",
      script: "res://scenes/AuthGate.acid",
      signals: [
        signal("auth-login", "on_user_login", "(session: Session)", "Emitted when a user completes sign-in.", [
          { nodeId: "auth-super-agent", method: "grantSession" },
        ]),
      ],
      children: [
        {
          id: "auth-super-agent",
          name: "AuthSuperAgent",
          className: "AutonomousAgent",
          kind: "agent",
          icon: "agent",
          summary: "Autonomous identity agent · validates sessions, rotates tokens and audits routes.",
          status: "idle",
          visible: true,
          file: "agents/AuthSuperAgent.agent.ts",
          script: "res://agents/AuthSuperAgent.agent.ts",
          signals: [
            signal("session-granted", "on_session_granted", "(claims)", "Emitted after token validation.", [
              { nodeId: "auth-gate", method: "unlock" },
            ]),
            signal("auth-error", "on_auth_error", "(error)", "Emitted when a session cannot be verified.", [
              { nodeId: "data-analyst-agent", method: "recoverAuth" },
            ]),
          ],
        },
      ],
    },
    {
      id: "workspace-shell",
      name: "WorkspaceShell",
      className: "LayoutContainer",
      kind: "ui",
      icon: "layout",
      summary: "Primary layout container · navigation, content region and agent overlays.",
      status: "idle",
      visible: true,
      file: "scenes/WorkspaceShell.acid",
      script: "res://scenes/WorkspaceShell.acid",
      signals: [
        signal("shell-mount", "on_mount", "()", "Emitted once the shell layout is hydrated.", [
          { nodeId: "dashboard-page", method: "mount" },
        ]),
      ],
      children: [
        {
          id: "top-navbar",
          name: "TopNavbar",
          className: "UIComponent",
          kind: "ui",
          icon: "navbar",
          summary: "Global command bar · navigation, environment state and dispatch actions.",
          status: "idle",
          visible: true,
          file: "components/TopNavbar.tsx",
          script: "res://components/TopNavbar.tsx",
          signals: [
            signal("nav-command", "on_command", "(command)", "Emitted when an operator dispatches a command.", [
              { nodeId: "dashboard-page", method: "dispatch" },
            ]),
          ],
        },
        {
          id: "dashboard-page",
          name: "DashboardPage",
          className: "ViewScene",
          kind: "ui",
          icon: "view",
          summary: "Primary analytics view · composes metrics, live data and agent activity.",
          status: "idle",
          visible: true,
          file: "scenes/DashboardPage.acid",
          script: "res://scenes/DashboardPage.acid",
          signals: [
            signal("scene-ready", "on_scene_ready", "()", "Emitted when all view nodes are mounted.", [
              { nodeId: "workspace-shell", method: "markReady" },
            ]),
            signal("build-error", "on_build_error", "(diagnostic)", "Emitted when the scene fails validation.", [
              { nodeId: "data-analyst-agent", method: "selfHeal" },
            ]),
          ],
          children: [
            {
              id: "metrics-grid",
              name: "MetricsGrid",
              className: "DataWidget",
              kind: "ui",
              icon: "widget",
              summary: "KPI widget grid · streams run, latency and token telemetry into the view.",
              status: "idle",
              visible: true,
              file: "components/MetricsGrid.tsx",
              script: "res://components/MetricsGrid.tsx",
              signals: [
                signal("metric-focus", "on_metric_selected", "(metric: string)", "Emitted when an operator inspects a metric.", [
                  { nodeId: "dashboard-page", method: "focusMetric" },
                ]),
              ],
            },
            {
              id: "live-feed-api",
              name: "LiveFeedAPI",
              className: "EdgeEndpoint",
              kind: "api",
              icon: "api",
              summary: "Streaming edge endpoint · pushes agent telemetry into the dashboard.",
              status: "idle",
              visible: true,
              file: "api/LiveFeedAPI.ts",
              script: "res://api/LiveFeedAPI.ts",
              signals: [
                signal("data-fetched", "on_data_fetched", "(payload)", "Emitted for every hydrated telemetry batch.", [
                  { nodeId: "metrics-grid", method: "update" },
                ]),
                signal("stream-error", "on_stream_error", "(error)", "Emitted when the edge stream drops.", [
                  { nodeId: "data-analyst-agent", method: "reconnect" },
                ]),
              ],
            },
            {
              id: "data-analyst-agent",
              name: "DataAnalystAgent",
              className: "SuperAgent",
              kind: "agent",
              icon: "agent",
              summary: "Autonomous analytics worker · plans queries, monitors telemetry and heals scenes.",
              status: "idle",
              visible: true,
              file: "agents/DataAnalystAgent.agent.ts",
              script: "res://agents/DataAnalystAgent.agent.ts",
              signals: [
                signal("run-dispatched", "on_run_dispatched", "(intent)", "Emitted when a new analysis run is queued.", [
                  { nodeId: "live-feed-api", method: "subscribe" },
                ]),
                signal("heal-complete", "on_heal_complete", "(patch)", "Emitted after a scene repair is verified.", [
                  { nodeId: "dashboard-page", method: "refresh" },
                ]),
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const INITIAL_SELECTED_NODE_ID = "data-analyst-agent";

export const INITIAL_EXPANDED: Record<string, boolean> = {
  "main-app": true,
  "auth-gate": true,
  "workspace-shell": true,
  "dashboard-page": true,
};

export function flattenScene(tree: SceneNode): SceneNode[] {
  const nodes: SceneNode[] = [tree];
  for (const child of tree.children ?? []) nodes.push(...flattenScene(child));
  return nodes;
}

export function findSceneNode(tree: SceneNode, id: string): SceneNode | null {
  if (tree.id === id) return tree;
  for (const child of tree.children ?? []) {
    const found = findSceneNode(child, id);
    if (found) return found;
  }
  return null;
}

export function scenePath(tree: SceneNode, id: string): SceneNode[] {
  if (tree.id === id) return [tree];
  for (const child of tree.children ?? []) {
    const trail = scenePath(child, id);
    if (trail.length > 0) return [tree, ...trail];
  }
  return [];
}

export function initialNodeStatuses(tree: SceneNode): Record<string, NodeStatus> {
  const statuses: Record<string, NodeStatus> = {};
  for (const node of flattenScene(tree)) statuses[node.id] = node.status;
  return statuses;
}

export function addSceneChild(tree: SceneNode, parentId: string, child: SceneNode): SceneNode {
  if (tree.id === parentId) {
    return { ...tree, children: [...(tree.children ?? []), child] };
  }
  if (!tree.children?.length) return tree;
  let changed = false;
  const children = tree.children.map((node) => {
    const next = addSceneChild(node, parentId, child);
    if (next !== node) changed = true;
    return next;
  });
  return changed ? { ...tree, children } : tree;
}

export function renameSceneNode(tree: SceneNode, id: string, name: string): SceneNode {
  if (tree.id === id) return { ...tree, name };
  if (!tree.children?.length) return tree;
  let changed = false;
  const children = tree.children.map((node) => {
    const next = renameSceneNode(node, id, name);
    if (next !== node) changed = true;
    return next;
  });
  return changed ? { ...tree, children } : tree;
}

export function updateSceneVisibility(tree: SceneNode, id: string, visible: boolean): SceneNode {
  if (tree.id === id) return { ...tree, visible };
  if (!tree.children?.length) return tree;
  let changed = false;
  const children = tree.children.map((node) => {
    const next = updateSceneVisibility(node, id, visible);
    if (next !== node) changed = true;
    return next;
  });
  return changed ? { ...tree, children } : tree;
}

export function countSceneNodes(tree: SceneNode): number {
  return flattenScene(tree).length;
}

export function sceneNodeOptions(tree: SceneNode): { node: SceneNode; depth: number }[] {
  const options: { node: SceneNode; depth: number }[] = [];
  const walk = (node: SceneNode, depth: number) => {
    options.push({ node, depth });
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(tree, 0);
  return options;
}

export function descendantIds(node: SceneNode): string[] {
  return (node.children ?? []).flatMap((child) => [child.id, ...descendantIds(child)]);
}

export function isDescendant(tree: SceneNode, ancestorId: string, id: string): boolean {
  const ancestor = findSceneNode(tree, ancestorId);
  return ancestor ? descendantIds(ancestor).includes(id) : false;
}
