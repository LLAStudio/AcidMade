import type { CodeFile } from "../types";

const file = (
  id: string,
  path: string,
  group: string,
  language: CodeFile["language"],
  generatedBy: string,
  content: string,
  additions: number,
  deletions = 0,
): CodeFile => ({
  id,
  path,
  name: path.split("/").at(-1) ?? path,
  group,
  language,
  additions,
  deletions,
  generatedBy,
  content,
});

export const CODE_FILES: CodeFile[] = [
  file(
    "main-scene",
    "scenes/MainApp.acid",
    "scenes",
    "json",
    "ScaffolderAgent",
    `{
  "acid": "1.0",
  "root": "MainApp",
  "class": "AppRoot",
  "entry": "res://scenes/DashboardPage.acid",
  "theme": {
    "accent": "#CCFF00",
    "density": "engine",
    "radius": 4
  },
  "agents": [
    "res://agents/AuthSuperAgent.agent.ts",
    "res://agents/DataAnalystAgent.agent.ts"
  ],
  "signals": {
    "on_ready": ["WorkspaceShell.mount"]
  }
}`,
    22,
  ),
  file(
    "auth-scene",
    "scenes/AuthGate.acid",
    "scenes",
    "json",
    "AuthSuperAgent",
    `{
  "class": "RouteGuard",
  "parent": "res://scenes/MainApp.acid",
  "policy": "workspace:read",
  "agent": "res://agents/AuthSuperAgent.agent.ts",
  "on_user_login": ["AuthSuperAgent.grantSession"],
  "on_session_granted": ["AuthGate.unlock"]
}`,
    12,
  ),
  file(
    "shell-scene",
    "scenes/WorkspaceShell.acid",
    "scenes",
    "json",
    "UIComposer",
    `{
  "class": "LayoutContainer",
  "parent": "res://scenes/MainApp.acid",
  "layout": { "mode": "flex", "direction": "row", "gap": 0 },
  "children": [
    "res://components/TopNavbar.tsx",
    "res://scenes/DashboardPage.acid"
  ],
  "on_mount": ["DashboardPage.mount"]
}`,
    16,
  ),
  file(
    "dashboard-scene",
    "scenes/DashboardPage.acid",
    "scenes",
    "json",
    "UIComposer",
    `{
  "class": "ViewScene",
  "route": "/",
  "components": {
    "MetricsGrid": "res://components/MetricsGrid.tsx",
    "TopNavbar": "res://components/TopNavbar.tsx"
  },
  "bindings": {
    "LiveFeedAPI.on_data_fetched": "MetricsGrid.update",
    "DashboardPage.on_build_error": "DataAnalystAgent.selfHeal"
  },
  "agents": ["DataAnalystAgent"]
}`,
    28,
    3,
  ),
  file(
    "data-agent-prompt",
    "agents/DataAnalystAgent.prompt",
    "agents",
    "prompt",
    "Operator",
    `# DataAnalystAgent

You are the analytics worker for the Northwind workspace.

## Mission
Keep the dashboard truthful, fast and self-healing.

## Tools
- fs.read / fs.write for scene resources
- esbuild.transform for view modules
- tsc --noEmit for scene validation
- signal.connect for agent wiring

## Contract
1. Read the active scene before writing.
2. Explain each tool call in one line.
3. Never ship a scene with open diagnostics.
4. On failure, patch the smallest possible surface.
5. Hand off to SelfHealer when a type error is detected.`,
    18,
  ),
  file(
    "data-agent",
    "agents/DataAnalystAgent.agent.ts",
    "agents",
    "ts",
    "DataAnalystAgent",
    `import { defineAgent, tool } from "@acidmade/engine";

export default defineAgent({
  name: "DataAnalystAgent",
  model: "claude-sonnet-4-6",
  autonomy: "full-acid",
  memory: "project-wide",
  maxSteps: 25,
  tools: [
    tool.fs.read({ scope: "res://scenes" }),
    tool.fs.write({ scope: "res://components" }),
    tool.esbuild.transform(),
    tool.tsc.noEmit(),
    tool.signal.connect(),
  ],
  on: {
    run_dispatched: ({ intent }) => plan(intent),
    build_error: ({ diagnostic }) => selfHeal(diagnostic),
    heal_complete: ({ patch }) => verify(patch),
  },
});`,
    34,
  ),
  file(
    "auth-agent",
    "agents/AuthSuperAgent.agent.ts",
    "agents",
    "ts",
    "AuthSuperAgent",
    `import { defineAgent, tool } from "@acidmade/engine";

export default defineAgent({
  name: "AuthSuperAgent",
  model: "gemini-2.5-pro",
  autonomy: "ask-permission",
  memory: "session",
  maxSteps: 12,
  tools: [
    tool.secrets.read({ scope: "workspace" }),
    tool.http.request({ allow: ["auth.internal"] }),
    tool.signals.emit(),
  ],
  on: {
    user_login: ({ session }) => grantSession(session),
    auth_error: ({ error }) => report(error),
  },
});`,
    24,
  ),
  file(
    "top-navbar",
    "components/TopNavbar.tsx",
    "components",
    "tsx",
    "UIComposer",
    `import { Search, ShieldCheck, Sparkles } from "lucide-react";

export function TopNavbar({ onDispatch }: { onDispatch: () => void }) {
  return (
    <header className="flex h-12 items-center border-b border-[#e4e7dd] px-4">
      <span className="text-[13px] font-semibold">Northwind</span>
      <span className="ml-2 flex items-center gap-1 rounded border px-1.5 text-[9px]">
        <ShieldCheck size={10} /> SSO
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Search size={13} className="text-[#8c9387]" />
        <button onClick={onDispatch} className="flex items-center gap-1 rounded bg-[#10150f] px-2 py-1 text-[10px] text-white">
          <Sparkles size={10} className="text-[#ccff00]" />
          Dispatch
        </button>
      </div>
    </header>
  );
}`,
    20,
  ),
  file(
    "metrics-grid",
    "components/MetricsGrid.tsx",
    "components",
    "tsx",
    "UIComposer",
    `import { useMemo } from "react";
import type { TelemetryBatch } from "../api/LiveFeedAPI";

type Metric = { label: string; value: string; delta: string };

export function MetricsGrid({ batch }: { batch: TelemetryBatch }) {
  const metrics = useMemo<Metric[]>(
    () => [
      { label: "Active runs", value: batch.runs.toLocaleString(), delta: "+12.4%" },
      { label: "Success rate", value: batch.success + "%", delta: "+0.6%" },
      { label: "Median latency", value: batch.latency + "ms", delta: "−38ms" },
      { label: "Tokens burned", value: batch.tokens, delta: "+2.1M" },
    ],
    [batch],
  );

  return (
    <section className="grid grid-cols-4 gap-2.5">
      {metrics.map((metric) => (
        <article key={metric.label} className="rounded border bg-white p-3">
          <span className="text-[9px] uppercase tracking-wider">{metric.label}</span>
          <strong className="mt-1 block text-[21px]">{metric.value}</strong>
          <span className="text-[8px] text-[#9da397]">{metric.delta}</span>
        </article>
      ))}
    </section>
  );
}`,
    32,
    4,
  ),
  file(
    "live-feed",
    "api/LiveFeedAPI.ts",
    "api",
    "ts",
    "SignalWrangler",
    `import { defineEndpoint, signal } from "@acidmade/engine";

export type TelemetryBatch = {
  runs: number;
  success: number;
  latency: number;
  tokens: string;
};

export default defineEndpoint({
  path: "/api/live-feed",
  method: "GET",
  cache: "edge",
  rateLimit: "120 req/min",
  emits: signal<TelemetryBatch>("on_data_fetched"),
  async handler(ctx) {
    const batch = await ctx.telemetry.latest();
    await ctx.emit("on_data_fetched", batch);
    return ctx.stream(batch, { heartbeat: 15000 });
  },
});`,
    22,
  ),
  file(
    "acid-config",
    "acid.config.json",
    "root",
    "json",
    "AcidEngine",
    `{
  "project": "northwind-analytics",
  "runtime": {
    "engine": "2.0.1",
    "sceneFormat": "acid/1.0",
    "agentPlanner": "local-reference",
    "workspace": ".acidmade/runs"
  },
  "build": {
    "transformer": "esbuild",
    "typecheck": "tsc --noEmit",
    "artifact": "deploy/bundle.json.gz"
  },
  "signals": { "strict": true, "trace": true }
}`,
    17,
  ),
];

export const INITIAL_FILE_ID = "data-agent-prompt";

export function resourceByPath(path: string): CodeFile | undefined {
  return CODE_FILES.find((entry) => entry.path === path);
}

export function resourceById(id: string): CodeFile | undefined {
  return CODE_FILES.find((entry) => entry.id === id);
}
