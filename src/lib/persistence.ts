import { CODE_FILES, INITIAL_FILE_ID } from "../data/resources";
import {
  INITIAL_EXPANDED,
  INITIAL_SELECTED_NODE_ID,
  flattenScene,
} from "../data/scene";
import type {
  EngineMode,
  NodeKind,
  NodeOverrides,
  OverrideValue,
  SceneIconKey,
  SceneNode,
  SignalDefinition,
} from "../types";
import { isKnownTabId } from "./tabs";

const STORAGE_KEY = "acidmade.workspace.v1";
const MAX_TREE_NODES = 500;
const MAX_TREE_DEPTH = 40;
const MAX_OVERRIDE_NODES = 400;
const MAX_OVERRIDE_KEYS = 80;
const MAX_STRING = 5000;

const NODE_KINDS = new Set<NodeKind>(["root", "ui", "component", "api", "data", "agent"]);
const NODE_ICONS = new Set<SceneIconKey>([
  "root",
  "guard",
  "layout",
  "navbar",
  "view",
  "widget",
  "agent",
  "api",
  "control",
  "data",
]);
const ENGINE_MODES = new Set<EngineMode>(["viewport", "script", "signals", "agents"]);

export interface WorkspaceSnapshot {
  tree: SceneNode;
  overrides: NodeOverrides;
  closedTabIds: string[];
  activeFileId: string;
  mode: EngineMode;
  selectedNodeId: string;
  expanded: Record<string, boolean>;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max = MAX_STRING): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalText(value: unknown, max = MAX_STRING): string | undefined {
  const next = text(value, max);
  return next || undefined;
}

function sanitizeSignals(value: unknown): SignalDefinition[] {
  if (!Array.isArray(value)) return [];
  const signals: SignalDefinition[] = [];
  for (const raw of value.slice(0, 40)) {
    if (!isRecord(raw)) continue;
    const id = text(raw.id, 96);
    const name = text(raw.name, 96);
    if (!id || !name) continue;
    const connections = Array.isArray(raw.connections)
      ? raw.connections
          .slice(0, 24)
          .flatMap((connection) => {
            if (!isRecord(connection)) return [];
            const nodeId = text(connection.nodeId, 96);
            const method = text(connection.method, 96);
            return nodeId && method ? [{ nodeId, method }] : [];
          })
      : [];
    signals.push({
      id,
      name,
      args: text(raw.args, 240),
      description: text(raw.description, 600),
      connections,
    });
  }
  return signals;
}

function sanitizeNode(
  value: unknown,
  seen: Set<string>,
  budget: { count: number },
  depth = 0,
): SceneNode | null {
  if (!isRecord(value) || depth > MAX_TREE_DEPTH || budget.count >= MAX_TREE_NODES) {
    return null;
  }
  const id = text(value.id, 96);
  const name = text(value.name, 48);
  const className = text(value.className, 96);
  const kind = text(value.kind, 20) as NodeKind;
  const icon = text(value.icon, 20) as SceneIconKey;
  if (!id || !name || !className || seen.has(id)) return null;
  if (!NODE_KINDS.has(kind) || !NODE_ICONS.has(icon)) return null;

  seen.add(id);
  budget.count += 1;

  const children: SceneNode[] = [];
  if (Array.isArray(value.children)) {
    for (const raw of value.children) {
      const child = sanitizeNode(raw, seen, budget, depth + 1);
      if (child) children.push(child);
    }
  }

  const node: SceneNode = {
    id,
    name,
    className,
    kind,
    icon,
    summary: text(value.summary, 600),
    status: "idle",
    visible: value.visible !== false,
    signals: sanitizeSignals(value.signals),
  };

  const file = optionalText(value.file, 200);
  const script = optionalText(value.script, 200);
  if (file) node.file = file;
  if (script) node.script = script;
  if (children.length > 0) node.children = children;
  return node;
}

function sanitizeOverrides(value: unknown, tree: SceneNode): NodeOverrides {
  if (!isRecord(value)) return {};
  const validNodeIds = new Set(flattenScene(tree).map((node) => node.id));
  const next: NodeOverrides = {};
  let nodeCount = 0;

  for (const [nodeId, rawProperties] of Object.entries(value)) {
    if (!validNodeIds.has(nodeId) || nodeCount >= MAX_OVERRIDE_NODES) continue;
    if (!isRecord(rawProperties)) continue;
    const properties: Record<string, OverrideValue> = {};
    let keyCount = 0;
    for (const [key, rawValue] of Object.entries(rawProperties)) {
      if (keyCount >= MAX_OVERRIDE_KEYS) break;
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) continue;
      if (typeof rawValue === "boolean" || (typeof rawValue === "number" && Number.isFinite(rawValue))) {
        properties[key] = rawValue;
      } else if (typeof rawValue === "string") {
        properties[key] = rawValue.slice(0, MAX_STRING);
      } else {
        continue;
      }
      keyCount += 1;
    }
    if (keyCount > 0) {
      next[nodeId] = properties;
      nodeCount += 1;
    }
  }
  return next;
}

function sanitizeExpanded(value: unknown, tree: SceneNode): Record<string, boolean> {
  const next: Record<string, boolean> = { ...INITIAL_EXPANDED };
  if (!isRecord(value)) return next;
  const validNodeIds = new Set(flattenScene(tree).map((node) => node.id));
  let count = 0;
  for (const [id, raw] of Object.entries(value)) {
    if (count >= 400) break;
    if (!validNodeIds.has(id) || typeof raw !== "boolean") continue;
    next[id] = raw;
    count += 1;
  }
  return next;
}

function sanitizeClosedTabs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const raw of value.slice(0, 60)) {
    if (typeof raw === "string" && isKnownTabId(raw)) ids.add(raw);
  }
  return [...ids];
}

export function loadWorkspace(): WorkspaceSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return null;

    const tree = sanitizeNode(parsed.tree, new Set(), { count: 0 });
    if (!tree) return null;

    const validFileIds = new Set(CODE_FILES.map((file) => file.id));
    const activeFileId =
      typeof parsed.activeFileId === "string" && validFileIds.has(parsed.activeFileId)
        ? parsed.activeFileId
        : INITIAL_FILE_ID;
    const mode = ENGINE_MODES.has(parsed.mode as EngineMode)
      ? (parsed.mode as EngineMode)
      : "viewport";
    const selectedNodeId =
      typeof parsed.selectedNodeId === "string" &&
      flattenScene(tree).some((node) => node.id === parsed.selectedNodeId)
        ? parsed.selectedNodeId
        : flattenScene(tree).some((node) => node.id === INITIAL_SELECTED_NODE_ID)
          ? INITIAL_SELECTED_NODE_ID
          : tree.id;

    return {
      tree,
      overrides: sanitizeOverrides(parsed.overrides, tree),
      closedTabIds: sanitizeClosedTabs(parsed.closedTabIds),
      activeFileId,
      mode,
      selectedNodeId,
      expanded: sanitizeExpanded(parsed.expanded, tree),
    };
  } catch {
    return null;
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        ...snapshot,
      }),
    );
  } catch {
    // Local persistence is best-effort; the live engine state still works.
  }
}

export function clearWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A blocked storage backend should not break the reset action.
  }
}
