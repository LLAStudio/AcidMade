import type { OverrideValue, SceneNode } from "../types";

export const ROOT_DEFAULTS: Record<string, OverrideValue> = {
  visible: true,
  process: "Inherit",
  x: 0,
  y: 0,
  layoutMode: "Flex",
  flexDirection: "Column",
  gap: 16,
  width: 1440,
  height: 900,
  tailwind: "min-h-screen bg-[#f6f7f2]",
};

export const UI_DEFAULTS: Record<string, OverrideValue> = {
  visible: true,
  process: "Inherit",
  x: 0,
  y: 0,
  layoutMode: "Flex",
  flexDirection: "Column",
  gap: 12,
  padding: 16,
  width: 720,
  height: 320,
  grow: 1,
  tailwind: "rounded-[8px] border border-[#e4e7dd] bg-white",
};

export const AGENT_DEFAULTS: Record<string, OverrideValue> = {
  visible: true,
  process: "Inherit",
  model: "claude-sonnet-4-6",
  autonomy: "Full-Acid Auto",
  maxSteps: 25,
  memoryScope: "Project-Wide",
  temperature: 0.4,
  canReadFiles: true,
  canExecTerminal: true,
  canSelfHeal: true,
  canDeployProd: false,
  systemPrompt:
    "You are the DataAnalystAgent inside AcidMade. Inspect the scene graph, repair diagnostics and report every tool call.",
};

export const API_DEFAULTS: Record<string, OverrideValue> = {
  visible: true,
  process: "Inherit",
  method: "GET",
  timeout: 2400,
  retries: 2,
  cache: "Edge",
  rateLimit: "120 req/min",
};

export const DATA_DEFAULTS: Record<string, OverrideValue> = {
  visible: true,
  process: "Inherit",
  engine: "Postgres",
  region: "iad1",
  schema: "public",
  pool: 12,
};

export function defaultProps(node: SceneNode): Record<string, OverrideValue> {
  switch (node.kind) {
    case "agent":
      return { ...AGENT_DEFAULTS };
    case "api":
      return { ...API_DEFAULTS };
    case "data":
      return { ...DATA_DEFAULTS };
    case "root":
      return { ...ROOT_DEFAULTS };
    default:
      return { ...UI_DEFAULTS };
  }
}

export const MODEL_OPTIONS = [
  "claude-sonnet-4-6",
  "gemini-2.5-pro",
  "gpt-5-codex",
  "ollama/llama3.3",
];

export const AUTONOMY_OPTIONS = ["Full-Acid Auto", "Ask Permission", "Assisted"];
export const MEMORY_OPTIONS = ["Project-Wide", "Session", "Node-Local"];
export const LAYOUT_OPTIONS = ["Flex", "Grid", "Stack", "Absolute"];
export const DIRECTION_OPTIONS = ["Column", "Row", "Wrap"];
