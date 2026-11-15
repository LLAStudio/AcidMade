export type EngineMode = "viewport" | "script" | "signals" | "agents";

export type SceneIconKey =
  | "root"
  | "guard"
  | "layout"
  | "navbar"
  | "view"
  | "widget"
  | "agent"
  | "api"
  | "control"
  | "data";

export type NodeKind = "root" | "ui" | "component" | "api" | "data" | "agent";

export type NodeStatus = "idle" | "running" | "healthy" | "error";

export type AutoLevel = "Full-Acid Auto" | "Ask Permission" | "Assisted";

export type DockTab = "output" | "stream" | "debugger" | "build" | "terminal";

export type RightTab = "inspector" | "node";

export type ViewportTool = "select" | "move" | "resize";

export type LogLevel = "info" | "ok" | "warn" | "error" | "action" | "muted";

export type Device = "desktop" | "mobile";

export type RunKind = "build" | "deploy";

export type RunStatus =
  | "idle"
  | "building"
  | "running"
  | "deploying"
  | "deployed"
  | "halted"
  | "failed";

export interface SignalConnection {
  nodeId: string;
  method: string;
}

export interface SignalDefinition {
  id: string;
  name: string;
  args: string;
  description: string;
  connections: SignalConnection[];
}

export interface SceneNode {
  id: string;
  name: string;
  className: string;
  kind: NodeKind;
  icon: SceneIconKey;
  summary: string;
  status: NodeStatus;
  visible: boolean;
  file?: string;
  script?: string;
  signals: SignalDefinition[];
  children?: SceneNode[];
}

export type CodeLanguage = "tsx" | "ts" | "json" | "css" | "md" | "prompt";

export interface CodeFile {
  id: string;
  path: string;
  name: string;
  group: string;
  language: CodeLanguage;
  additions: number;
  deletions: number;
  generatedBy: string;
  content: string;
}

export interface LogEntry {
  id: string;
  time: string;
  agent: string;
  channel: "console" | "build";
  level: LogLevel;
  message: string;
  nodeId?: string;
  tool?: string;
}

export interface Problem {
  id: string;
  severity: "error" | "warning";
  file: string;
  line: number;
  message: string;
  code: string;
  healed: boolean;
}

export interface DiffFile {
  id: string;
  path: string;
  additions: number;
  deletions: number;
  preview: string[];
  agent: string;
}

export interface RunState {
  kind: RunKind | null;
  status: RunStatus;
  progress: number;
  currentAgent: string | null;
  startedAt: number | null;
  session: number;
}

export type OverrideValue = string | boolean | number;
export type NodeOverrides = Record<string, Record<string, OverrideValue>>;
