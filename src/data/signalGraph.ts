export interface SignalGraphNode {
  id: string;
  x: number;
  y: number;
}

export interface SignalGraphEdge {
  id: string;
  from: string;
  to: string;
  signal: string;
  tone: "ui" | "logic" | "agent";
}

export const SIGNAL_GRAPH_NODES: SignalGraphNode[] = [
  { id: "main-app", x: 36, y: 40 },
  { id: "auth-gate", x: 300, y: 20 },
  { id: "auth-super-agent", x: 610, y: 34 },
  { id: "workspace-shell", x: 300, y: 180 },
  { id: "top-navbar", x: 36, y: 300 },
  { id: "dashboard-page", x: 300, y: 340 },
  { id: "metrics-grid", x: 610, y: 300 },
  { id: "live-feed-api", x: 610, y: 470 },
  { id: "data-analyst-agent", x: 860, y: 380 },
];

export const SIGNAL_GRAPH_EDGES: SignalGraphEdge[] = [
  { id: "e-main-shell", from: "main-app", to: "workspace-shell", signal: "on_ready()", tone: "ui" },
  { id: "e-auth-agent", from: "auth-gate", to: "auth-super-agent", signal: "on_user_login()", tone: "agent" },
  { id: "e-agent-gate", from: "auth-super-agent", to: "auth-gate", signal: "on_session_granted()", tone: "agent" },
  { id: "e-shell-page", from: "workspace-shell", to: "dashboard-page", signal: "on_mount()", tone: "ui" },
  { id: "e-nav-page", from: "top-navbar", to: "dashboard-page", signal: "on_command()", tone: "ui" },
  { id: "e-page-metrics", from: "dashboard-page", to: "metrics-grid", signal: "on_scene_ready()", tone: "ui" },
  { id: "e-feed-metrics", from: "live-feed-api", to: "metrics-grid", signal: "on_data_fetched()", tone: "logic" },
  { id: "e-page-agent", from: "dashboard-page", to: "data-analyst-agent", signal: "on_build_error()", tone: "logic" },
  { id: "e-agent-feed", from: "data-analyst-agent", to: "live-feed-api", signal: "on_run_dispatched()", tone: "agent" },
  { id: "e-agent-page", from: "data-analyst-agent", to: "dashboard-page", signal: "on_heal_complete()", tone: "agent" },
];

export const GRAPH_OFFSETS: Record<string, { x: number; y: number }> = {
  "main-app": { x: 0, y: 0 },
  "auth-gate": { x: 0, y: 0 },
  "auth-super-agent": { x: 0, y: 0 },
  "workspace-shell": { x: 0, y: 0 },
  "top-navbar": { x: 0, y: 0 },
  "dashboard-page": { x: 0, y: 0 },
  "metrics-grid": { x: 0, y: 0 },
  "live-feed-api": { x: 0, y: 0 },
  "data-analyst-agent": { x: 0, y: 0 },
};

export const SIGNAL_TRACE = [
  { time: "14:02:11.204", signal: "on_user_login()", route: "AuthGate → AuthSuperAgent", tone: "agent" },
  { time: "14:02:11.688", signal: "on_session_granted()", route: "AuthSuperAgent → AuthGate", tone: "agent" },
  { time: "14:02:12.031", signal: "on_data_fetched()", route: "LiveFeedAPI → MetricsGrid", tone: "logic" },
  { time: "14:02:12.310", signal: "on_metric_selected()", route: "MetricsGrid → DashboardPage", tone: "ui" },
];
