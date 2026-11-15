import type { DiffFile, LogLevel, NodeStatus, Problem } from "../types";

export interface SimulationStep {
  at: number;
  agent: string;
  level: LogLevel;
  channel?: "console" | "build";
  message: string;
  nodeId?: string;
  nodeStatus?: NodeStatus;
  progress: number;
  addProblem?: Omit<Problem, "id" | "healed">;
  healProblems?: boolean;
  addDiff?: Omit<DiffFile, "id">;
}

const diagnose: Omit<Problem, "id" | "healed"> = {
  severity: "error",
  file: "components/MetricsGrid.tsx",
  line: 34,
  code: "TS2322",
  message: "Type '{ latency: number }' is not assignable to type 'string'.",
};

const metricDiff: Omit<DiffFile, "id"> = {
  path: "components/MetricsGrid.tsx",
  additions: 4,
  deletions: 2,
  agent: "UIComposer",
  preview: [
    "@@ -31,7 +31,9 @@ export function MetricsGrid",
    "   return (",
    "-    <span>{batch.latency}ms</span>",
    "+    <span className=\"font-mono\">",
    "+      {batch.latency.toFixed(0)}ms",
    "+    </span>",
    "   );",
  ],
};

export const BUILD_STEPS: SimulationStep[] = [
  {
    at: 60,
    agent: "AcidEngine",
    level: "muted",
    message: "AcidMade Engine v1.0.1.stable · scene runtime 1.0.1 · target desktop",
    progress: 1,
  },
  {
    at: 180,
    agent: "DataAnalystAgent",
    level: "action",
    message: "play requested · intent=build & validate res://scenes/DashboardPage.acid",
    nodeId: "data-analyst-agent",
    nodeStatus: "running",
    progress: 5,
  },
  {
    at: 360,
    agent: "AuthSuperAgent",
    level: "info",
    message: "validating workspace session contract · policy=workspace:read",
    nodeId: "auth-super-agent",
    nodeStatus: "running",
    progress: 12,
  },
  {
    at: 620,
    agent: "UIComposer",
    level: "action",
    message: "compiling res://scenes/MainApp.acid → WorkspaceShell",
    nodeId: "main-app",
    nodeStatus: "running",
    progress: 20,
  },
  {
    at: 900,
    agent: "UIComposer",
    level: "info",
    message: "instantiated res://scenes/DashboardPage.acid · 3 child nodes",
    nodeId: "dashboard-page",
    nodeStatus: "running",
    progress: 29,
    addDiff: {
      path: "scenes/DashboardPage.acid",
      additions: 28,
      deletions: 3,
      agent: "UIComposer",
      preview: [
        "@@ -1,5 +1,9 @@",
        ' "class": "ViewScene",',
        '-  "components": { "MetricsGrid": "..." }',
        '+  "components": {',
        '+    "MetricsGrid": "res://components/MetricsGrid.tsx"',
        '+  },',
      ],
    },
  },
  {
    at: 1200,
    agent: "SignalWrangler",
    level: "info",
    message: "wiring on_data_fetched → MetricsGrid.update()",
    nodeId: "metrics-grid",
    nodeStatus: "running",
    progress: 38,
  },
  {
    at: 1450,
    agent: "EdgeAPI",
    level: "action",
    message: "compiled res://api/LiveFeedAPI.ts · edge cache=stale-while-revalidate",
    nodeId: "live-feed-api",
    nodeStatus: "running",
    progress: 45,
    addDiff: {
      path: "api/LiveFeedAPI.ts",
      additions: 22,
      deletions: 0,
      agent: "SignalWrangler",
      preview: [
        "@@ -1,4 +1,10 @@",
        '+export default defineEndpoint({',
        '+  path: "/api/live-feed",',
        '+  emits: signal<TelemetryBatch>("on_data_fetched"),',
        "+});",
      ],
    },
  },
  {
    at: 1750,
    agent: "Build",
    level: "info",
    channel: "build",
    message: "esbuild transform · 11 modules · 14.2 kB",
    progress: 54,
  },
  {
    at: 1980,
    agent: "Build",
    level: "error",
    channel: "build",
    message: "tsc --noEmit · components/MetricsGrid.tsx(34,3): error TS2322",
    nodeId: "metrics-grid",
    nodeStatus: "error",
    progress: 58,
    addProblem: diagnose,
  },
  {
    at: 2200,
    agent: "SelfHealer",
    level: "warn",
    message: "diagnostic captured · narrowing latency to string at render boundary",
    nodeId: "metrics-grid",
    nodeStatus: "running",
    progress: 66,
    addDiff: metricDiff,
  },
  {
    at: 2520,
    agent: "SelfHealer",
    level: "ok",
    message: "patch applied · re-running tsc --noEmit",
    progress: 75,
    healProblems: true,
  },
  {
    at: 2780,
    agent: "Build",
    level: "ok",
    channel: "build",
    message: "re-typecheck exit 0 · 0 diagnostics · esbuild emitted 7 outputs",
    nodeId: "metrics-grid",
    nodeStatus: "healthy",
    progress: 86,
  },
  {
    at: 3040,
    agent: "DataAnalystAgent",
    level: "ok",
    message: "scene healthy · signals resolved · agent overlay attached",
    nodeId: "data-analyst-agent",
    nodeStatus: "healthy",
    progress: 94,
  },
  {
    at: 3300,
    agent: "AcidEngine",
    level: "ok",
    message: "play session live · MainApp running on res://scenes/DashboardPage.acid",
    progress: 100,
  },
];

export const DEPLOY_STEPS: SimulationStep[] = [
  {
    at: 120,
    agent: "DataAnalystAgent",
    level: "action",
    message: "export requested · staging production artifact for northwind-analytics",
    nodeId: "data-analyst-agent",
    nodeStatus: "running",
    progress: 6,
  },
  {
    at: 520,
    agent: "AcidEngine",
    level: "info",
    message: "scene pack · res://scenes/*.acid · res://agents/*.agent.ts",
    progress: 22,
  },
  {
    at: 980,
    agent: "Build",
    level: "info",
    channel: "build",
    message: "bundle · gzip(res://) · sha1 manifest · integrity verified",
    progress: 62,
  },
  {
    at: 1460,
    agent: "DataAnalystAgent",
    level: "ok",
    message: "deployment staged locally · .acidmade/runs/<id>/deploy/bundle.json.gz",
    progress: 92,
  },
  {
    at: 1760,
    agent: "AcidEngine",
    level: "ok",
    message: "export complete · no remote publisher configured · artifact retained",
    progress: 100,
  },
];
