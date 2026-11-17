import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { BUILD_STEPS, DEPLOY_STEPS, type SimulationStep } from "../data/buildScript";
import { DEFAULT_PROJECT, PROJECTS, mergeProjects, type Project } from "../data/projects";
import { INITIAL_FILE_ID, resourceByPath } from "../data/resources";
import {
  INITIAL_EXPANDED,
  INITIAL_SELECTED_NODE_ID,
  SCENE_TREE,
  addSceneChild,
  findSceneNode,
  flattenScene,
  initialNodeStatuses,
  renameSceneNode,
  scenePath,
  sceneNodeOptions,
  updateSceneVisibility,
} from "../data/scene";
import type {
  Device,
  DiffFile,
  DockTab,
  EngineMode,
  LogEntry,
  LogLevel,
  NodeKind,
  NodeOverrides,
  NodeStatus,
  OverrideValue,
  Problem,
  RightTab,
  RunKind,
  RunState,
  SceneIconKey,
  SceneNode,
} from "../types";
import { nowStamp, uid } from "../lib/utils";
import { APP_VERSION } from "../lib/version";
import { clearWorkspace, loadWorkspace, saveWorkspace } from "../lib/persistence";
import { loadLauncher, saveLauncher } from "../lib/launcher";
import {
  createProjectOnDisk,
  isDiskBacked,
  listProjects,
  markProjectBridgeReady,
  onProjectFileOpen,
  openProjectByPath,
  takePendingProject,
} from "../lib/projects";
import { tabIdForFile } from "../lib/tabs";
import {
  connectRunStream,
  getRuntimeInfo,
  pauseRuntimeRun,
  resumeRuntimeRun,
  startRuntimeRun,
  stopRuntimeRun,
  type RuntimeEvent,
  type RuntimeInfo,
} from "../lib/runtime";

type RuntimeStatus = "connecting" | "online" | "offline";

interface RuntimeState {
  status: RuntimeStatus;
  info: RuntimeInfo | null;
  error: string | null;
}

export interface NewNodeInput {
  parentId: string;
  name: string;
  className: string;
  kind: NodeKind;
  icon: SceneIconKey;
  summary: string;
}

export interface EngineState {
  mode: EngineMode;
  project: Project;
  projects: Project[];
  launcherOpen: boolean;
  tree: SceneNode;
  selectedNodeId: string;
  expanded: Record<string, boolean>;
  nodeStatuses: Record<string, NodeStatus>;
  overrides: NodeOverrides;
  run: RunState;
  runtime: RuntimeState;
  activeRunId: string | null;
  agentsPaused: boolean;
  logs: LogEntry[];
  problems: Problem[];
  diffs: DiffFile[];
  dockOpen: boolean;
  dockTab: DockTab;
  device: Device;
  zoom: number;
  paletteOpen: boolean;
  nodeModalOpen: boolean;
  aiOpen: boolean;
  settingsOpen: boolean;
  rightTab: RightTab;
  activeFileId: string;
  closedTabIds: string[];
}

const INITIAL_LOGS: LogEntry[] = [
  {
    id: uid("log"),
    time: nowStamp(),
    agent: "AcidEngine",
    channel: "console",
    level: "muted",
    message:
      "AcidMade Engine v" + APP_VERSION + ".stable · scene runtime online · project northwind-analytics",
  },
  {
    id: uid("log"),
    time: nowStamp(),
    agent: "AcidEngine",
    channel: "console",
    level: "info",
    message: "mounted res://scenes/MainApp.acid · 9 nodes · 0 open diagnostics",
  },
];

const INITIAL_STATE: EngineState = {
  mode: "viewport",
  project: DEFAULT_PROJECT,
  projects: PROJECTS,
  launcherOpen: true,
  tree: SCENE_TREE,
  selectedNodeId: INITIAL_SELECTED_NODE_ID,
  expanded: { ...INITIAL_EXPANDED },
  nodeStatuses: initialNodeStatuses(SCENE_TREE),
  overrides: {},
  run: {
    kind: null,
    status: "idle",
    progress: 0,
    currentAgent: null,
    startedAt: null,
    session: 0,
  },
  runtime: {
    status: "connecting",
    info: null,
    error: null,
  },
  activeRunId: null,
  agentsPaused: false,
  logs: INITIAL_LOGS,
  problems: [],
  diffs: [],
  dockOpen: true,
  dockTab: "output",
  device: "desktop",
  zoom: 1,
  paletteOpen: false,
  nodeModalOpen: false,
  aiOpen: false,
  settingsOpen: false,
  rightTab: "inspector",
  activeFileId: INITIAL_FILE_ID,
  closedTabIds: [],
};

function hydrateEngineState(_initial: EngineState): EngineState {
  const launcher = loadLauncher();
  const projects = mergeProjects(launcher?.projects ?? []);
  const project = projects.find((entry) => entry.id === launcher?.projectId) ?? DEFAULT_PROJECT;
  const base: EngineState = { ...INITIAL_STATE, projects, project };
  const saved = loadWorkspace();
  if (!saved) return base;
  return {
    ...base,
    mode: saved.mode,
    tree: saved.tree,
    selectedNodeId: saved.selectedNodeId,
    expanded: saved.expanded,
    nodeStatuses: initialNodeStatuses(saved.tree),
    overrides: saved.overrides,
    activeFileId: saved.activeFileId,
    closedTabIds: saved.closedTabIds,
    dockOpen: saved.dockOpen,
    dockTab: saved.dockTab,
    device: saved.device,
    zoom: saved.zoom,
    rightTab: saved.rightTab,
  };
}

type Action =
  | { type: "set-mode"; mode: EngineMode }
  | { type: "select-node"; id: string }
  | { type: "toggle-node"; id: string }
  | { type: "toggle-visibility"; id: string }
  | { type: "set-override"; nodeId: string; key: string; value: OverrideValue }
  | { type: "configure-node"; nodeId: string; changes: Record<string, OverrideValue> }
  | { type: "reset-overrides"; nodeId: string }
  | { type: "set-project"; project: Project }
  | { type: "open-launcher" }
  | { type: "launch-project"; project: Project }
  | { type: "create-project"; project: Project }
  | { type: "set-projects"; projects: Project[] }
  | { type: "add-node"; input: NewNodeInput }
  | { type: "rename-node"; nodeId: string; name: string }
  | { type: "run-start"; kind: RunKind }
  | { type: "step"; step: SimulationStep; time: string }
  | { type: "run-finish"; kind: RunKind }
  | { type: "halt" }
  | { type: "log"; entry: LogEntry }
  | { type: "clear-logs" }
  | { type: "set-dock-tab"; tab: DockTab }
  | { type: "toggle-dock" }
  | { type: "set-device"; device: Device }
  | { type: "set-zoom"; zoom: number }
  | { type: "set-palette"; open: boolean }
  | { type: "set-node-modal"; open: boolean }
  | { type: "set-ai"; open: boolean }
  | { type: "set-settings"; open: boolean }
  | { type: "set-right-tab"; tab: RightTab }
  | { type: "set-active-file"; id: string }
  | { type: "open-file"; path: string }
  | { type: "close-tab"; id: string }
  | { type: "open-tab"; id: string }
  | { type: "reset-workspace" }
  | { type: "set-paused"; paused: boolean }
  | {
      type: "runtime-state";
      status: RuntimeStatus;
      info?: RuntimeInfo | null;
      error?: string | null;
    }
  | { type: "active-run"; runId: string | null }
  | { type: "runtime-event"; event: RuntimeEvent }
  | { type: "remote-failed"; message: string };

function makeLog(entry: Omit<LogEntry, "id">): LogEntry {
  return { id: uid("log"), ...entry };
}

const RUNTIME_NODE_ALIASES: Record<string, string> = {
  "root-app": "main-app",
  "auth-module": "auth-super-agent",
  "sidebar-nav": "top-navbar",
  "data-grid": "metrics-grid",
  "backend-api": "live-feed-api",
  "runs-route": "live-feed-api",
  "dashboard-view": "dashboard-page",
  "orchestrator-agent": "data-analyst-agent",
};

const RUNTIME_AGENT_LABELS: Record<string, string> = {
  ORCHESTRATOR: "DataAnalystAgent",
  "AUTH-GUARD": "AuthSuperAgent",
  "UI-COMPOSER": "UIComposer",
  "EDGE-API": "SignalWrangler",
  "SELF-HEALER": "SelfHealer",
  BUILD: "Build",
  ENGINE: "AcidEngine",
};

function displayAgent(agent: string): string {
  return RUNTIME_AGENT_LABELS[agent] ?? agent;
}

function runtimeNodeId(id: string): string {
  return RUNTIME_NODE_ALIASES[id] ?? id;
}

function logAgent(agent: string): string {
  return displayAgent(agent);
}

function createNode(input: NewNodeInput, tree: SceneNode): SceneNode {
  const base = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "node";
  let id = base;
  let suffix = 2;
  while (findSceneNode(tree, id)) {
    id = base + "-" + suffix;
    suffix += 1;
  }
  return {
    id,
    name: input.name,
    className: input.className,
    kind: input.kind,
    icon: input.icon,
    summary: input.summary,
    status: "idle",
    visible: true,
    signals: [],
  };
}

function setAllHealthy(nodeStatuses: Record<string, NodeStatus>): Record<string, NodeStatus> {
  const next: Record<string, NodeStatus> = {};
  Object.keys(nodeStatuses).forEach((id) => {
    next[id] = "healthy";
  });
  return next;
}

function clearRunning(nodeStatuses: Record<string, NodeStatus>): Record<string, NodeStatus> {
  const next = { ...nodeStatuses };
  Object.keys(next).forEach((id) => {
    if (next[id] === "running") next[id] = "idle";
  });
  return next;
}

function reducer(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case "set-mode":
      return { ...state, mode: action.mode };
    case "select-node": {
      const trail = scenePath(state.tree, action.id);
      if (trail.length === 0) return state;
      const expanded = { ...state.expanded };
      trail.slice(0, -1).forEach((node) => {
        expanded[node.id] = true;
      });
      const node = trail[trail.length - 1];
      const resource = node.file ? resourceByPath(node.file) : undefined;
      return {
        ...state,
        selectedNodeId: action.id,
        expanded,
        activeFileId: resource?.id ?? state.activeFileId,
      };
    }
    case "toggle-node":
      return {
        ...state,
        expanded: { ...state.expanded, [action.id]: !state.expanded[action.id] },
      };
    case "toggle-visibility": {
      const node = findSceneNode(state.tree, action.id);
      if (!node) return state;
      return {
        ...state,
        tree: updateSceneVisibility(state.tree, action.id, !node.visible),
      };
    }
    case "set-override":
      return {
        ...state,
        overrides: {
          ...state.overrides,
          [action.nodeId]: {
            ...(state.overrides[action.nodeId] ?? {}),
            [action.key]: action.value,
          },
        },
      };
    case "configure-node": {
      const target = findSceneNode(state.tree, action.nodeId);
      const keys = Object.keys(action.changes);
      if (!target || keys.length === 0) return state;
      const entry = makeLog({
        time: nowStamp(),
        agent: "AcidAI",
        channel: "console",
        level: "action",
        message:
          "configured node " +
          target.name +
          " · " +
          keys
            .map((key) => key + "=" + String(action.changes[key]).slice(0, 48))
            .join(" · "),
      });
      return {
        ...state,
        overrides: {
          ...state.overrides,
          [action.nodeId]: {
            ...(state.overrides[action.nodeId] ?? {}),
            ...action.changes,
          },
        },
        selectedNodeId: target.id,
        rightTab: "inspector",
        logs: [...state.logs, entry].slice(-800),
      };
    }
    case "rename-node": {
      const target = findSceneNode(state.tree, action.nodeId);
      if (!target || !action.name.trim() || target.name === action.name) return state;
      const entry = makeLog({
        time: nowStamp(),
        agent: "AcidAI",
        channel: "console",
        level: "action",
        message: "renamed node " + target.name + " → " + action.name + " · " + target.id,
      });
      return {
        ...state,
        tree: renameSceneNode(state.tree, action.nodeId, action.name),
        selectedNodeId: target.id,
        rightTab: "inspector",
        logs: [...state.logs, entry].slice(-800),
      };
    }
    case "reset-overrides": {
      const overrides = { ...state.overrides };
      delete overrides[action.nodeId];
      return { ...state, overrides };
    }
    case "set-project":
      return { ...state, project: action.project };
    case "open-launcher":
      return { ...state, launcherOpen: true };
    case "set-projects": {
      if (action.projects.length === 0) return state;
      const current = action.projects.find((entry) => entry.id === state.project.id);
      return {
        ...state,
        projects: action.projects,
        project: current ?? action.projects[0],
      };
    }
    case "launch-project": {
      // Projects opened from outside the store folder are not in the list yet,
      // so add them before switching to them.
      const known = state.projects.some(
        (entry) => entry.id === action.project.id || entry.path === action.project.path,
      );
      return {
        ...state,
        projects: known ? state.projects : [...state.projects, action.project],
        project: action.project,
        launcherOpen: false,
        mode: "viewport",
        // Keep the dock state the user left behind; a run opens it explicitly.
        dockOpen: state.dockOpen,
        dockTab: state.dockTab,
      };
    }
    case "create-project": {
      const entry = makeLog({
        time: nowStamp(),
        agent: "AcidEngine",
        channel: "console",
        level: "action",
        message:
          "created project " + action.project.name + " · " + action.project.slug + " · " + action.project.branch,
      });
      return {
        ...state,
        projects: [...state.projects, action.project],
        project: action.project,
        launcherOpen: false,
        mode: "viewport",
        dockOpen: true,
        dockTab: "output",
        logs: [...state.logs, entry].slice(-800),
      };
    }
    case "add-node": {
      const parent = findSceneNode(state.tree, action.input.parentId);
      if (!parent) return state;
      const node = createNode(action.input, state.tree);
      const entry = makeLog({
        time: nowStamp(),
        agent: "AcidEngine",
        channel: "console",
        level: "action",
        message:
          "created node " +
          node.name +
          " <" +
          node.className +
          "> under " +
          parent.name +
          " · " +
          node.id,
      });
      return {
        ...state,
        tree: addSceneChild(state.tree, parent.id, node),
        expanded: { ...state.expanded, [parent.id]: true },
        selectedNodeId: node.id,
        nodeStatuses: { ...state.nodeStatuses, [node.id]: "idle" },
        nodeModalOpen: false,
        rightTab: "inspector",
        logs: [...state.logs, entry].slice(-800),
      };
    }
    case "run-start": {
      const session = state.run.session + 1;
      const nodeStatuses: Record<string, NodeStatus> = {};
      Object.keys(state.nodeStatuses).forEach((id) => {
        nodeStatuses[id] = action.kind === "build" ? "idle" : state.nodeStatuses[id];
      });
      nodeStatuses["data-analyst-agent"] = "running";
      const entry = makeLog({
        time: nowStamp(),
        agent: "AcidEngine",
        channel: "console",
        level: "action",
        message:
          "--- play session #" +
          session +
          " started --- · " +
          (action.kind === "build"
            ? "compile + validate res://scenes/MainApp.acid"
            : "stage export artifact"),
      });
      return {
        ...state,
        mode: action.kind === "deploy" ? state.mode : "viewport",
        logs: [...state.logs, entry].slice(-800),
        nodeStatuses,
        problems: action.kind === "build" ? [] : state.problems,
        diffs: action.kind === "build" ? [] : state.diffs,
        dockOpen: true,
        dockTab: action.kind === "deploy" ? "build" : "output",
        activeRunId: null,
        agentsPaused: false,
        run: {
          kind: action.kind,
          status: action.kind === "build" ? "building" : "deploying",
          progress: 2,
          currentAgent: "DataAnalystAgent",
          startedAt: Date.now(),
          session,
        },
      };
    }
    case "step": {
      const { step } = action;
      const entry = makeLog({
        time: action.time,
        agent: step.agent,
        channel: step.channel ?? "console",
        level: step.level,
        message: step.message,
        nodeId: step.nodeId,
      });
      const nodeStatuses = { ...state.nodeStatuses };
      if (step.nodeId && step.nodeStatus) nodeStatuses[step.nodeId] = step.nodeStatus;
      let problems = state.problems;
      if (step.addProblem) {
        problems = [...problems, { ...step.addProblem, id: uid("prob"), healed: false }];
      }
      if (step.healProblems) {
        problems = problems.map((problem) =>
          problem.healed ? problem : { ...problem, healed: true },
        );
      }
      let diffs = state.diffs;
      if (step.addDiff) {
        diffs = [
          { ...step.addDiff, id: uid("diff") },
          ...diffs.filter((diff) => diff.path !== step.addDiff?.path),
        ];
      }
      return {
        ...state,
        logs: [...state.logs, entry].slice(-800),
        nodeStatuses,
        problems,
        diffs,
        run: {
          ...state.run,
          progress: Math.max(state.run.progress, step.progress),
          currentAgent: step.agent,
        },
      };
    }
    case "run-finish":
      return {
        ...state,
        nodeStatuses: setAllHealthy(state.nodeStatuses),
        activeRunId: null,
        agentsPaused: false,
        run: {
          ...state.run,
          status: action.kind === "build" ? "running" : "deployed",
          progress: 100,
          currentAgent: null,
        },
      };
    case "halt":
      return {
        ...state,
        nodeStatuses: clearRunning(state.nodeStatuses),
        activeRunId: null,
        agentsPaused: false,
        run: { ...state.run, status: "halted", currentAgent: null },
        dockTab: "output",
        dockOpen: true,
      };
    case "log":
      return { ...state, logs: [...state.logs, action.entry].slice(-800) };
    case "clear-logs":
      return { ...state, logs: [] };
    case "set-dock-tab":
      return { ...state, dockTab: action.tab, dockOpen: true };
    case "toggle-dock":
      return { ...state, dockOpen: !state.dockOpen };
    case "set-device":
      return { ...state, device: action.device };
    case "set-zoom":
      return { ...state, zoom: action.zoom };
    case "set-palette":
      return { ...state, paletteOpen: action.open };
    case "set-node-modal":
      return { ...state, nodeModalOpen: action.open };
    case "set-ai":
      return { ...state, aiOpen: action.open };
    case "set-settings":
      return { ...state, settingsOpen: action.open };
    case "set-right-tab":
      return { ...state, rightTab: action.tab };
    case "set-active-file":
      return { ...state, activeFileId: action.id };
    case "open-file": {
      const resource = resourceByPath(action.path);
      if (!resource) return state;
      const node = flattenScene(state.tree).find((item) => item.file === action.path);
      return {
        ...state,
        mode: "script",
        activeFileId: resource.id,
        selectedNodeId: node?.id ?? state.selectedNodeId,
        closedTabIds: state.closedTabIds.filter((id) => id !== tabIdForFile(resource.id)),
      };
    }
    case "close-tab": {
      if (!action.id || state.closedTabIds.includes(action.id)) return state;
      return { ...state, closedTabIds: [...state.closedTabIds, action.id] };
    }
    case "open-tab": {
      if (!state.closedTabIds.includes(action.id)) return state;
      return {
        ...state,
        closedTabIds: state.closedTabIds.filter((id) => id !== action.id),
      };
    }
    case "reset-workspace": {
      const entry = makeLog({
        time: nowStamp(),
        agent: "AcidEngine",
        channel: "console",
        level: "action",
        message: "workspace reset to defaults · scene tree restored · overrides cleared · tabs reopened",
      });
      return {
        ...state,
        mode: "viewport",
        tree: SCENE_TREE,
        selectedNodeId: INITIAL_SELECTED_NODE_ID,
        expanded: { ...INITIAL_EXPANDED },
        nodeStatuses: initialNodeStatuses(SCENE_TREE),
        overrides: {},
        activeFileId: INITIAL_FILE_ID,
        closedTabIds: [],
        rightTab: "inspector",
        logs: [...state.logs, entry].slice(-800),
      };
    }
    case "set-paused":
      return { ...state, agentsPaused: action.paused };
    case "runtime-state":
      return {
        ...state,
        runtime: {
          status: action.status,
          info: action.info !== undefined ? action.info : state.runtime.info,
          error: action.error !== undefined ? action.error : state.runtime.error,
        },
      };
    case "active-run":
      return { ...state, activeRunId: action.runId };
    case "remote-failed": {
      const entry = makeLog({
        time: nowStamp(),
        agent: "AcidEngine",
        channel: "console",
        level: "error",
        message: action.message,
      });
      return {
        ...state,
        logs: [...state.logs, entry].slice(-800),
        nodeStatuses: clearRunning(state.nodeStatuses),
        activeRunId: null,
        agentsPaused: false,
        run: { ...state.run, status: "failed", currentAgent: null },
      };
    }
    case "runtime-event": {
      const event = action.event;

      switch (event.type) {
        case "started":
          return state;
        case "log": {
          const entry = makeLog({
            time: event.time,
            agent: logAgent(event.agent),
            channel: event.channel ?? "console",
            level: event.level,
            message: event.message,
            nodeId: event.nodeId ? runtimeNodeId(event.nodeId) : undefined,
            tool: event.tool,
          });
          return { ...state, logs: [...state.logs, entry].slice(-800) };
        }
        case "node": {
          const id = runtimeNodeId(event.nodeId);
          if (state.nodeStatuses[id] === undefined) return state;
          return {
            ...state,
            nodeStatuses: { ...state.nodeStatuses, [id]: event.status },
          };
        }
        case "progress":
          return {
            ...state,
            run: {
              ...state.run,
              progress: Math.max(state.run.progress, Math.min(event.value, 100)),
              currentAgent: event.agent
                ? displayAgent(event.agent)
                : state.run.currentAgent,
            },
          };
        case "problem":
          return {
            ...state,
            problems: [
              ...state.problems.filter((problem) => problem.id !== event.problem.id),
              { ...event.problem, healed: false },
            ],
          };
        case "healed":
          return {
            ...state,
            problems: state.problems.map((problem) =>
              problem.id === event.problemId ? { ...problem, healed: true } : problem,
            ),
          };
        case "diff":
          return {
            ...state,
            diffs: [
              event.diff,
              ...state.diffs.filter((diff) => diff.path !== event.diff.path),
            ],
          };
        case "status": {
          if (event.status === "halted" || event.status === "failed") {
            return {
              ...state,
              nodeStatuses: clearRunning(state.nodeStatuses),
              activeRunId: null,
              agentsPaused: false,
              run: {
                ...state.run,
                status: event.status === "halted" ? "halted" : "failed",
                currentAgent: null,
              },
            };
          }
          return {
            ...state,
            nodeStatuses: setAllHealthy(state.nodeStatuses),
            activeRunId: null,
            agentsPaused: false,
            run: {
              ...state.run,
              status: state.run.kind === "deploy" ? "deployed" : "running",
              progress: 100,
              currentAgent: null,
            },
          };
        }
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

interface EngineActions {
  setMode: (mode: EngineMode) => void;
  selectNode: (id: string) => void;
  toggleNode: (id: string) => void;
  toggleVisibility: (id: string) => void;
  setOverride: (nodeId: string, key: string, value: OverrideValue) => void;
  configureNode: (nodeId: string, changes: Record<string, OverrideValue>) => void;
  resetOverrides: (nodeId: string) => void;
  setProject: (project: Project) => void;
  openLauncher: () => void;
  launchProject: (project: Project) => void;
  createProject: (input: { name: string; template?: string }) => Promise<Project>;
  refreshProjects: () => void;
  addNode: (input: NewNodeInput) => void;
  renameNode: (nodeId: string, name: string) => void;
  startBuild: () => void;
  runScene: () => void;
  stopRun: () => void;
  togglePause: () => void;
  deploy: () => void;
  clearLogs: () => void;
  setDockTab: (tab: DockTab) => void;
  toggleDock: () => void;
  setDevice: (device: Device) => void;
  setZoom: (zoom: number) => void;
  setPalette: (open: boolean) => void;
  setNodeModalOpen: (open: boolean) => void;
  setAiOpen: (open: boolean) => void;
  setSettings: (open: boolean) => void;
  setRightTab: (tab: RightTab) => void;
  setActiveFile: (id: string) => void;
  openFile: (path: string) => void;
  closeTab: (id: string) => void;
  openTab: (id: string) => void;
  resetWorkspace: () => void;
  pushLog: (agent: string, level: LogLevel, message: string) => void;
  refreshRuntime: () => void;
}

type EngineContextValue = EngineState &
  EngineActions & { state: EngineState; canStop: boolean; canPause: boolean };

const EngineContext = createContext<EngineContextValue | null>(null);

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "unknown runtime error";
}

export function EngineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, hydrateEngineState);
  const timers = useRef<number[]>([]);
  const stream = useRef<EventSource | null>(null);
  const activeRunRef = useRef<string | null>(null);
  const pausedRef = useRef(false);
  const attemptRef = useRef(0);
  const launchLock = useRef(false);
  const projectRef = useRef(state.project);

  useEffect(() => {
    projectRef.current = state.project;
  }, [state.project]);

  useEffect(() => {
    saveWorkspace({
      tree: state.tree,
      overrides: state.overrides,
      closedTabIds: state.closedTabIds,
      activeFileId: state.activeFileId,
      mode: state.mode,
      selectedNodeId: state.selectedNodeId,
      expanded: state.expanded,
      dockOpen: state.dockOpen,
      dockTab: state.dockTab,
      device: state.device,
      zoom: state.zoom,
      rightTab: state.rightTab,
    });
  }, [
    state.activeFileId,
    state.closedTabIds,
    state.dockOpen,
    state.dockTab,
    state.device,
    state.expanded,
    state.mode,
    state.overrides,
    state.rightTab,
    state.selectedNodeId,
    state.tree,
    state.zoom,
  ]);

  useEffect(() => {
    saveLauncher({
      projectId: state.project.id,
      projects: state.projects.filter((entry) => entry.custom),
    });
  }, [state.project.id, state.projects]);

  useEffect(() => {
    pausedRef.current = state.agentsPaused;
  }, [state.agentsPaused]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const closeStream = useCallback(() => {
    stream.current?.close();
    stream.current = null;
  }, []);

  const probeRuntime = useCallback(async () => {
    dispatch({ type: "runtime-state", status: "connecting" });
    try {
      const info = await getRuntimeInfo();
      dispatch({ type: "runtime-state", status: "online", info, error: null });
    } catch (error) {
      dispatch({
        type: "runtime-state",
        status: "offline",
        info: null,
        error: messageOf(error),
      });
    }
  }, []);

  useEffect(() => {
    void probeRuntime();
  }, [probeRuntime]);

  useEffect(() => {
    return () => {
      clearTimers();
      stream.current?.close();
      stream.current = null;
      const activeId = activeRunRef.current;
      if (activeId) void stopRuntimeRun(activeId).catch(() => {});
    };
  }, [clearTimers]);

  const scheduleFallback = useCallback(
    (steps: SimulationStep[], kind: RunKind) => {
      clearTimers();
      let last = 0;
      steps.forEach((step) => {
        last = Math.max(last, step.at);
        timers.current.push(
          window.setTimeout(() => {
            dispatch({ type: "step", step, time: nowStamp() });
          }, step.at),
        );
      });
      timers.current.push(
        window.setTimeout(() => dispatch({ type: "run-finish", kind }), last + 450),
      );
    },
    [clearTimers],
  );

  const attachStream = useCallback(
    (runId: string) => {
      closeStream();
      let retryTimer: number | null = null;

      const clearRetry = () => {
        if (retryTimer !== null) {
          window.clearTimeout(retryTimer);
          retryTimer = null;
        }
      };

      const failStream = (message: string) => {
        if (activeRunRef.current !== runId) return;
        clearRetry();
        activeRunRef.current = null;
        closeStream();
        void stopRuntimeRun(runId).catch(() => {});
        dispatch({ type: "runtime-state", status: "offline", error: message });
        dispatch({ type: "remote-failed", message });
      };

      const scheduleFailure = () => {
        if (retryTimer !== null) return;
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (activeRunRef.current !== runId) return;
          if (source.readyState !== EventSource.OPEN) {
            failStream("event stream timed out · local runtime stopped responding");
          }
        }, 10000);
      };

      const source = connectRunStream(runId, {
        onOpen: () => {
          clearRetry();
          dispatch({ type: "runtime-state", status: "online", error: null });
        },
        onEvent: (event) => {
          clearRetry();
          dispatch({ type: "runtime-event", event });
          if (event.type === "status") {
            activeRunRef.current = null;
            closeStream();
          }
        },
        onError: (eventSource) => {
          if (activeRunRef.current !== runId) return;
          if (eventSource.readyState === EventSource.CLOSED) {
            failStream("event stream closed before the run completed");
            return;
          }
          dispatch({
            type: "runtime-state",
            status: "offline",
            error: "sse disconnected · reconnecting",
          });
          scheduleFailure();
        },
        onInvalid: () => {
          dispatch({
            type: "log",
            entry: makeLog({
              time: nowStamp(),
              agent: "AcidEngine",
              channel: "console",
              level: "warn",
              message: "discarded malformed runtime event",
            }),
          });
        },
      });

      stream.current = source;
    },
    [closeStream],
  );

  const beginRemoteRun = useCallback(
    async (kind: RunKind, attempt: number) => {
      try {
        const response = await startRuntimeRun({
          kind,
          project: projectRef.current.slug,
          intent:
            kind === "build"
              ? "Play and validate the " + projectRef.current.name + " scene graph."
              : "Stage a local export artifact for " + projectRef.current.name + ".",
        });

        if (attempt !== attemptRef.current) {
          void stopRuntimeRun(response.runId).catch(() => {});
          return;
        }

        launchLock.current = false;
        activeRunRef.current = response.runId;
        dispatch({ type: "active-run", runId: response.runId });
        dispatch({ type: "runtime-state", status: "online", error: null });
        dispatch({
          type: "log",
          entry: makeLog({
            time: nowStamp(),
            agent: "AcidEngine",
            channel: "console",
            level: "info",
            message: "local agent runtime attached · " + response.runId + " · sse open",
          }),
        });
        attachStream(response.runId);
      } catch (error) {
        if (attempt !== attemptRef.current) return;

        const code = (error as { code?: string }).code;
        const activeRunId = (error as { activeRunId?: string }).activeRunId;

        launchLock.current = false;

        if (code === "run_active" && activeRunId) {
          activeRunRef.current = activeRunId;
          dispatch({ type: "active-run", runId: activeRunId });
          dispatch({ type: "runtime-state", status: "online", error: null });
          dispatch({
            type: "log",
            entry: makeLog({
              time: nowStamp(),
              agent: "AcidEngine",
              channel: "console",
              level: "warn",
              message: "runtime already executing · attached to " + activeRunId,
            }),
          });
          attachStream(activeRunId);
          return;
        }

        const message = messageOf(error);
        dispatch({
          type: "runtime-state",
          status: "offline",
          info: null,
          error: message,
        });
        dispatch({
          type: "log",
          entry: makeLog({
            time: nowStamp(),
            agent: "AcidEngine",
            channel: "console",
            level: "warn",
            message:
              "local runtime unavailable · " + message + " · replaying reference stream",
          }),
        });
        scheduleFallback(kind === "build" ? BUILD_STEPS : DEPLOY_STEPS, kind);
      }
    },
    [attachStream, scheduleFallback],
  );

  const launchRun = useCallback(
    (kind: RunKind) => {
      if (launchLock.current) return;
      launchLock.current = true;
      attemptRef.current += 1;
      const attempt = attemptRef.current;
      clearTimers();
      closeStream();
      activeRunRef.current = null;
      dispatch({ type: "run-start", kind });
      dispatch({
        type: "log",
        entry: makeLog({
          time: nowStamp(),
          agent: "AcidEngine",
          channel: "console",
          level: "info",
          message: "dispatching local agent runtime · POST /api/runs · kind=" + kind,
        }),
      });
      void beginRemoteRun(kind, attempt);
    },
    [beginRemoteRun, clearTimers, closeStream],
  );

  const abortActiveRun = useCallback(() => {
    launchLock.current = false;
    attemptRef.current += 1;
    clearTimers();
    closeStream();
    const remoteId = activeRunRef.current;
    activeRunRef.current = null;
    if (remoteId) void stopRuntimeRun(remoteId).catch(() => {});
    dispatch({
      type: "log",
      entry: makeLog({
        time: nowStamp(),
        agent: "AcidEngine",
        channel: "console",
        level: "error",
        message: "execution halted by operator · in-flight tool calls aborted",
      }),
    });
    dispatch({ type: "halt" });
  }, [clearTimers, closeStream]);

  const togglePause = useCallback(() => {
    const runId = activeRunRef.current;
    if (!runId) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    dispatch({ type: "set-paused", paused: next });
    dispatch({
      type: "log",
      entry: makeLog({
        time: nowStamp(),
        agent: "AcidEngine",
        channel: "console",
        level: next ? "warn" : "info",
        message: next ? "agent execution paused" : "agent execution resumed",
      }),
    });
    void (next ? pauseRuntimeRun(runId) : resumeRuntimeRun(runId)).catch((error) => {
      pausedRef.current = !next;
      dispatch({ type: "set-paused", paused: !next });
      dispatch({
        type: "log",
        entry: makeLog({
          time: nowStamp(),
          agent: "AcidEngine",
          channel: "console",
          level: "warn",
          message: "pause request failed · " + messageOf(error),
        }),
      });
    });
  }, []);

  const loadProjectList = useCallback(async () => {
    try {
      const result = await listProjects();
      if (result.diskBacked) dispatch({ type: "set-projects", projects: result.projects });
    } catch (error) {
      dispatch({
        type: "log",
        entry: makeLog({
          time: nowStamp(),
          agent: "AcidEngine",
          channel: "console",
          level: "warn",
          message: "project list unavailable · " + messageOf(error),
        }),
      });
    }
  }, []);

  useEffect(() => {
    void loadProjectList();
  }, [loadProjectList]);

  const busy = state.run.status === "building" || state.run.status === "deploying";
  const canStop =
    busy || state.run.status === "running" || state.run.status === "deployed";
  const canPause = Boolean(state.activeRunId) && (busy || state.run.status === "running");

  const actions = useMemo<EngineActions>(
    () => ({
      setMode: (mode) => dispatch({ type: "set-mode", mode }),
      selectNode: (id) => dispatch({ type: "select-node", id }),
      toggleNode: (id) => dispatch({ type: "toggle-node", id }),
      toggleVisibility: (id) => dispatch({ type: "toggle-visibility", id }),
      setOverride: (nodeId, key, value) =>
        dispatch({ type: "set-override", nodeId, key, value }),
      configureNode: (nodeId, changes) =>
        dispatch({ type: "configure-node", nodeId, changes }),
      resetOverrides: (nodeId) => dispatch({ type: "reset-overrides", nodeId }),
      setProject: (project) => {
        dispatch({ type: "set-project", project });
        dispatch({
          type: "log",
          entry: makeLog({
            time: nowStamp(),
            agent: "AcidEngine",
            channel: "console",
            level: "info",
            message: "project switched · " + project.name + " · " + project.branch,
          }),
        });
      },
      openLauncher: () => dispatch({ type: "open-launcher" }),
      launchProject: (project) => {
        dispatch({ type: "launch-project", project });
        dispatch({
          type: "log",
          entry: makeLog({
            time: nowStamp(),
            agent: "AcidEngine",
            channel: "console",
            level: "info",
            message: "opened project · " + project.name + " · " + project.slug,
          }),
        });
      },
      createProject: async (input) => {
        const project = await createProjectOnDisk(input);
        dispatch({ type: "create-project", project });
        return project;
      },
      refreshProjects: () => {
        void loadProjectList();
      },
      addNode: (input) => dispatch({ type: "add-node", input }),
      renameNode: (nodeId, name) => dispatch({ type: "rename-node", nodeId, name }),
      startBuild: () => {
        if (busy) return;
        launchRun("build");
      },
      runScene: () => {
        if (busy) return;
        launchRun("build");
      },
      stopRun: () => {
        if (!canStop) return;
        abortActiveRun();
      },
      togglePause: () => {
        if (!canPause) return;
        togglePause();
      },
      deploy: () => {
        if (busy) return;
        launchRun("deploy");
      },
      clearLogs: () => dispatch({ type: "clear-logs" }),
      setDockTab: (tab) => dispatch({ type: "set-dock-tab", tab }),
      toggleDock: () => dispatch({ type: "toggle-dock" }),
      setDevice: (device) => dispatch({ type: "set-device", device }),
      setZoom: (zoom) => dispatch({ type: "set-zoom", zoom }),
      setPalette: (open) => dispatch({ type: "set-palette", open }),
      setNodeModalOpen: (open) => dispatch({ type: "set-node-modal", open }),
      setAiOpen: (open) => dispatch({ type: "set-ai", open }),
      setSettings: (open) => dispatch({ type: "set-settings", open }),
      setRightTab: (tab) => dispatch({ type: "set-right-tab", tab }),
      setActiveFile: (id) => dispatch({ type: "set-active-file", id }),
      openFile: (path) => dispatch({ type: "open-file", path }),
      closeTab: (id) => dispatch({ type: "close-tab", id }),
      openTab: (id) => dispatch({ type: "open-tab", id }),
      resetWorkspace: () => {
        clearWorkspace();
        dispatch({ type: "reset-workspace" });
      },
      pushLog: (agent, level, message) =>
        dispatch({
          type: "log",
          entry: makeLog({
            time: nowStamp(),
            agent,
            channel: "console",
            level,
            message,
          }),
        }),
      refreshRuntime: () => {
        void probeRuntime();
      },
    }),
    [abortActiveRun, busy, canPause, canStop, loadProjectList, launchRun, probeRuntime, togglePause],
  );

  // Opening a .acm from the OS (double-click, command line, second instance)
  // goes straight to the editor instead of leaving the user in the launcher.
  const osActions = useRef(actions);
  osActions.current = actions;

  useEffect(() => {
    if (!isDiskBacked()) return;
    let disposed = false;

    const openFromOs = async (target: string) => {
      try {
        const opened = await openProjectByPath(target);
        if (disposed) return;
        osActions.current.launchProject(opened);
        osActions.current.pushLog("AcidEngine", "info", "opened from the OS · " + target);
      } catch (error: unknown) {
        if (disposed) return;
        osActions.current.pushLog("AcidEngine", "warn", "could not open " + target + " · " + String(error));
      }
    };

    const unsubscribe = onProjectFileOpen((target) => void openFromOs(target));
    void (async () => {
      const pending = await takePendingProject();
      markProjectBridgeReady();
      if (pending) await openFromOs(pending);
    })();

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo<EngineContextValue>(
    () => ({ ...state, ...actions, state, canStop, canPause }),
    [state, actions, canStop, canPause],
  );

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

export function useEngine() {
  const context = useContext(EngineContext);
  if (!context) throw new Error("useEngine must be used inside <EngineProvider>");
  return context;
}

export function useSceneOptions() {
  const { tree } = useEngine();
  return useMemo(() => sceneNodeOptions(tree), [tree]);
}
