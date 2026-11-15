import type { AiNodeAction } from "./ai";
import { NODE_CATALOG, type NodeClassDef } from "../data/nodeCatalog";
import {
  AUTONOMY_OPTIONS,
  DIRECTION_OPTIONS,
  LAYOUT_OPTIONS,
  MEMORY_OPTIONS,
  defaultProps,
} from "../data/nodeProps";
import { findSceneNode, flattenScene, scenePath } from "../data/scene";
import type {
  NodeKind,
  NodeOverrides,
  OverrideValue,
  SceneIconKey,
  SceneNode,
} from "../types";

const ALL_CLASSES = NODE_CATALOG.flatMap((group) => group.classes);
const MAX_ACTION_CHANGES = 12;
const KIND_LABELS: Record<NodeKind, string> = {
  root: "Root",
  ui: "UI",
  component: "Component",
  api: "API",
  data: "Data",
  agent: "Agent",
};

const NUMBER_BOUNDS: Record<string, [number, number]> = {
  temperature: [0, 2],
  maxSteps: [1, 200],
  gap: [0, 200],
  padding: [0, 200],
  grow: [0, 12],
  width: [1, 5000],
  height: [1, 5000],
  x: [-5000, 5000],
  y: [-5000, 5000],
  timeout: [100, 60000],
  retries: [0, 10],
  pool: [1, 100],
};

const ENUM_VALUES: Record<string, readonly string[]> = {
  autonomy: AUTONOMY_OPTIONS,
  memoryScope: MEMORY_OPTIONS,
  layoutMode: LAYOUT_OPTIONS,
  flexDirection: DIRECTION_OPTIONS,
  method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

export interface NodeActionFact {
  label: string;
  value: string;
}

export interface NodeActionChange {
  key: string;
  from: string;
  to: string;
}

export interface NodeActionProposal {
  type: AiNodeAction["type"];
  summary: string;
  description: string;
  facts: NodeActionFact[];
  changes?: NodeActionChange[];
  parentId?: string;
  nodeId?: string;
  name?: string;
  className?: string;
  kind?: NodeKind;
  icon?: SceneIconKey;
  nodeSummary?: string;
  config?: Record<string, OverrideValue>;
}

export type StageNodeActionResult =
  | { ok: true; proposal: NodeActionProposal }
  | { ok: false; error: string };

function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

function resolveNode(tree: SceneNode, idOrName: string): SceneNode | null {
  const query = idOrName.trim();
  if (!query) return null;
  const byId = findSceneNode(tree, query);
  if (byId) return byId;
  const matches = flattenScene(tree).filter((node) => sameName(node.name, query));
  return matches.length === 1 ? matches[0] : null;
}

function resolveClass(action: AiNodeAction): NodeClassDef | string {
  const requested = (action.className ?? "").trim().toLocaleLowerCase();
  const requestedKind = action.kind;
  let match: NodeClassDef | undefined;

  if (requested) {
    match = ALL_CLASSES.find(
      (item) =>
        item.className.toLocaleLowerCase() === requested ||
        item.label.toLocaleLowerCase() === requested ||
        item.id === requested,
    );
    if (!match) {
      return (
        "Unknown node class " +
        (action.className ?? "") +
        ". Available classes: " +
        ALL_CLASSES.map((item) => item.className).join(", ") +
        "."
      );
    }
    if (
      requestedKind &&
      requestedKind !== "component" &&
      match.kind !== requestedKind
    ) {
      return (
        match.className +
        " is a " +
        KIND_LABELS[match.kind] +
        " class, not " +
        KIND_LABELS[requestedKind] +
        "."
      );
    }
    return match;
  }

  if (requestedKind === "ui" || requestedKind === "component") {
    match = ALL_CLASSES.find((item) => item.className === "UIComponent");
  } else if (requestedKind === "api") {
    match = ALL_CLASSES.find((item) => item.className === "EdgeEndpoint");
  } else if (requestedKind === "data") {
    match = ALL_CLASSES.find((item) => item.className === "DataStore");
  } else if (requestedKind === "agent") {
    match = ALL_CLASSES.find((item) => item.className === "AutonomousAgent");
  }

  return match ?? "Choose a node class before staging this change.";
}

function pathLabel(tree: SceneNode, id: string): string {
  return scenePath(tree, id)
    .map((node) => node.name)
    .join(" / ");
}

function formatValue(value: OverrideValue): string {
  if (typeof value === "string") {
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length > 72 ? compact.slice(0, 69) + "…" : compact;
  }
  return String(value);
}

type CoercedValue =
  | { ok: true; value: OverrideValue }
  | { ok: false; error: string };

function coerceValue(key: string, raw: unknown, fallback: OverrideValue): CoercedValue {
  if (typeof fallback === "number") {
    const number = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(number)) return { ok: false, error: key + " needs a numeric value." };
    const rounded = Math.round(number);
    if (!Number.isInteger(number) && key !== "temperature") {
      return { ok: false, error: key + " needs a whole number." };
    }
    const bounds = NUMBER_BOUNDS[key];
    if (bounds && (rounded < bounds[0] || rounded > bounds[1])) {
      return {
        ok: false,
        error: key + " must be between " + bounds[0] + " and " + bounds[1] + ".",
      };
    }
    return { ok: true, value: number };
  }

  if (typeof fallback === "boolean") {
    if (typeof raw === "boolean") return { ok: true, value: raw };
    if (typeof raw === "string") {
      const normalized = raw.trim().toLocaleLowerCase();
      if (normalized === "true") return { ok: true, value: true };
      if (normalized === "false") return { ok: true, value: false };
    }
    return { ok: false, error: key + " needs true or false." };
  }

  if (typeof raw !== "string") return { ok: false, error: key + " needs a text value." };
  const value =
    key === "systemPrompt" || key === "tailwind"
      ? raw.trim()
      : raw.replace(/\s+/g, " ").trim();
  if (!value) return { ok: false, error: key + " cannot be empty." };
  if (key === "systemPrompt" && value.length > 5000) {
    return { ok: false, error: "systemPrompt is limited to 5000 characters." };
  }
  if (key !== "systemPrompt" && value.length > 1000) {
    return { ok: false, error: key + " is limited to 1000 characters." };
  }
  const allowed = ENUM_VALUES[key];
  if (allowed) {
    const match = allowed.find(
      (option) => option.toLocaleLowerCase() === value.toLocaleLowerCase(),
    );
    if (!match) {
      return { ok: false, error: key + " must be one of: " + allowed.join(", ") + "." };
    }
    return { ok: true, value: match };
  }
  if (key === "method") return { ok: true, value: value.toUpperCase() };
  if (key === "model" && value.length > 80) {
    return { ok: false, error: "The model name is too long." };
  }
  return { ok: true, value };
}

function stageCreate(
  action: AiNodeAction,
  tree: SceneNode,
  selectedNodeId: string,
): StageNodeActionResult {
  const name = cleanName(action.name);
  if (!name) return { ok: false, error: "The new node needs a name." };

  const resolved = resolveClass(action);
  if (typeof resolved === "string") return { ok: false, error: resolved };
  if (resolved.kind === "root") {
    return { ok: false, error: "A root node cannot be created from the scene dock." };
  }

  let parent: SceneNode | null = null;
  if (action.parentId?.trim()) {
    parent = resolveNode(tree, action.parentId);
    if (!parent) {
      return {
        ok: false,
        error: "Parent node \"" + action.parentId + "\" is not in the active scene.",
      };
    }
  } else {
    parent = findSceneNode(tree, selectedNodeId) ?? tree;
  }

  const duplicate = (parent.children ?? []).find((child) => sameName(child.name, name));
  if (duplicate) {
    return {
      ok: false,
      error: parent.name + " already has a child named " + duplicate.name + ".",
    };
  }

  return {
    ok: true,
    proposal: {
      type: "create",
      summary: "Create " + name,
      description:
        "Add a " + resolved.className + " beneath " + parent.name + " in the active scene.",
      facts: [
        { label: "Parent", value: parent.name + " · " + pathLabel(tree, parent.id) },
        { label: "Class", value: resolved.className + " · " + KIND_LABELS[resolved.kind] },
        { label: "Defaults", value: KIND_LABELS[resolved.kind] + " property profile" },
      ],
      parentId: parent.id,
      name,
      className: resolved.className,
      kind: resolved.kind,
      icon: resolved.icon,
      nodeSummary: "AI-created " + resolved.className + " · " + resolved.description,
    },
  };
}

function stageRename(action: AiNodeAction, tree: SceneNode): StageNodeActionResult {
  const nodeId = action.nodeId?.trim() ?? "";
  const target = resolveNode(tree, nodeId);
  if (!target) {
    return { ok: false, error: "Node \"" + nodeId + "\" is not in the active scene." };
  }

  const name = cleanName(action.name);
  if (!name) return { ok: false, error: "The new node name is empty." };
  if (target.name === name) {
    return { ok: false, error: "That node already has the name " + name + "." };
  }

  const path = scenePath(tree, target.id);
  const parent = path[path.length - 2];
  const collision = (parent?.children ?? []).find(
    (node) => node.id !== target.id && sameName(node.name, name),
  );
  if (collision) {
    return {
      ok: false,
      error: (parent?.name ?? "This parent") + " already has a child named " + collision.name + ".",
    };
  }

  const nextPath = [...path.slice(0, -1).map((node) => node.name), name].join(" / ");
  return {
    ok: true,
    proposal: {
      type: "rename",
      summary: "Rename " + target.name,
      description: "Rename this " + target.className + " to " + name + ".",
      facts: [
        { label: "Node", value: target.name + " · " + target.className },
        { label: "Path", value: nextPath },
      ],
      nodeId: target.id,
      name,
    },
  };
}

function stageConfigure(
  action: AiNodeAction,
  tree: SceneNode,
  overrides: NodeOverrides,
): StageNodeActionResult {
  const nodeId = action.nodeId?.trim() ?? "";
  const target = resolveNode(tree, nodeId);
  if (!target) {
    return { ok: false, error: "Node \"" + nodeId + "\" is not in the active scene." };
  }

  const entries = Object.entries(action.changes ?? {});
  if (entries.length === 0) {
    return { ok: false, error: "No property changes were proposed." };
  }
  if (entries.length > MAX_ACTION_CHANGES) {
    return {
      ok: false,
      error: "A single staged change can update at most " + MAX_ACTION_CHANGES + " properties.",
    };
  }

  const defaults = defaultProps(target);
  const allowedKeys = Object.keys(defaults).filter((key) => key !== "visible");
  const nextChanges: Record<string, OverrideValue> = {};
  const changes: NodeActionChange[] = [];

  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    if (!Object.prototype.hasOwnProperty.call(defaults, key) || key === "visible") {
      return {
        ok: false,
        error:
          "Property \"" +
          key +
          "\" is not editable on " +
          target.className +
          ". Allowed: " +
          allowedKeys.join(", ") +
          ".",
      };
    }
    const coerced = coerceValue(key, rawValue, defaults[key]);
    if (!coerced.ok) return { ok: false, error: coerced.error };
    const current = overrides[target.id]?.[key] ?? defaults[key];
    if (Object.is(current, coerced.value)) continue;
    nextChanges[key] = coerced.value;
    changes.push({
      key,
      from: formatValue(current),
      to: formatValue(coerced.value),
    });
  }

  if (changes.length === 0) {
    return {
      ok: false,
      error: "Those values already match " + target.name + ".",
    };
  }

  return {
    ok: true,
    proposal: {
      type: "configure",
      summary: "Configure " + target.name,
      description:
        "Update " +
        changes.length +
        " " +
        (changes.length === 1 ? "property" : "properties") +
        " on this " +
        target.className +
        ".",
      facts: [
        { label: "Node", value: target.name + " · " + target.className },
        { label: "Kind", value: KIND_LABELS[target.kind] },
      ],
      nodeId: target.id,
      changes,
      config: nextChanges,
    },
  };
}

export function stageNodeAction(
  action: AiNodeAction | null | undefined,
  tree: SceneNode,
  selectedNodeId: string,
  overrides: NodeOverrides,
): StageNodeActionResult {
  if (!action) return { ok: false, error: "The model did not include a scene action." };
  if (action.type === "create") return stageCreate(action, tree, selectedNodeId);
  if (action.type === "rename") return stageRename(action, tree);
  if (action.type === "configure") return stageConfigure(action, tree, overrides);
  return { ok: false, error: "That scene action is not supported." };
}
