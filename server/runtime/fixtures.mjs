export const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["lib/scene-contract.ts"]
}
`;

const SIDEBAR_NAV = `import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/runs", label: "Agent runs" },
  { href: "/dashboard/streams", label: "Streams" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function SidebarNav({ workspace }: { workspace: string }) {
  return (
    <aside className="hidden w-[236px] shrink-0 flex-col bg-[#0f120e] p-4 text-white md:flex">
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-md bg-[#d4ff3f]" />
        <span className="text-sm font-semibold">{workspace}</span>
      </div>

      <nav className="mt-7 flex flex-col gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md px-3 py-2 text-sm text-white/60"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-white/10 p-3">
        <p className="text-[11px] uppercase tracking-widest text-white/40">
          Orchestrator
        </p>
        <p className="mt-1 text-sm">4 agents online</p>
      </div>
    </aside>
  );
}
`;

const DATA_GRID = `"use client";

import { useMemo, useState } from "react";

export interface RunRow {
  id: string;
  agent: string;
  status: "running" | "succeeded" | "failed" | "queued";
  tokens: number;
}

export function DataGrid({ rows }: { rows: RunRow[] }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => rows.filter((row) => row.agent.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-semibold">Agent runs</h2>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter agents"
          className="h-7 rounded-md border border-neutral-200 px-2 text-xs"
        />
      </header>

      <table className="w-full text-left text-[13px]">
        <thead className="text-[11px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2">Agent</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id} className="border-t border-neutral-100">
              <td className="px-4 py-2 font-medium">{row.agent}</td>
              <td className="px-4 py-2">{row.status}</td>
              <td className="px-4 py-2 text-right font-mono">{row.tokens}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
`;

const DASHBOARD_PAGE = `import { DataGrid, type RunRow } from "@/components/DataGrid";
import { SidebarNav } from "@/components/SidebarNav";

const rows: RunRow[] = [
  { id: "run-1", agent: "UI-COMPOSER", status: "running", tokens: 18420 },
  { id: "run-2", agent: "AUTH-GUARD", status: "succeeded", tokens: 4180 },
  { id: "run-3", agent: "EDGE-API", status: "succeeded", tokens: 6940 },
  { id: "run-4", agent: "SELF-HEALER", status: "succeeded", tokens: 2310 },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#f7f8f5]">
      <SidebarNav workspace="Northwind" />
      <main className="flex-1 px-8 py-7">
        <p className="text-xs uppercase tracking-widest text-neutral-500">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold">Agent operations</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Autonomous runs across the Northwind workspace.
        </p>
        <div className="mt-6">
          <DataGrid rows={rows} />
        </div>
      </main>
    </div>
  );
}
`;

const AGENTS_ROUTE = `import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  return NextResponse.json(
    { runs: [], limit },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as { intent?: string };

  if (!body.intent) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  return NextResponse.json({ queued: true }, { status: 202 });
}
`;

const AUTH_GUARD = `const POLICIES = {
  "dashboard:read": ["owner", "admin", "viewer"],
  "runs:read": ["owner", "admin", "viewer"],
  "runs:write": ["owner", "admin"],
  "billing:manage": ["owner"],
} as const;

export type Permission = keyof typeof POLICIES;

export function can(roles: readonly string[], permission: Permission) {
  return roles.some((role) =>
    (POLICIES[permission] as readonly string[]).includes(role),
  );
}

export function permissionsFor(roles: readonly string[]) {
  return (Object.keys(POLICIES) as Permission[]).filter((permission) =>
    can(roles, permission),
  );
}
`;

const ORCHESTRATOR = `const SYSTEM_PROMPT = [
  "Resolve the scene graph before editing files.",
  "Delegate UI work to UI-COMPOSER and API work to EDGE-API.",
  "Every filesystem call must map to a scene node.",
].join(" ");

export async function orchestrate(intent: string) {
  return {
    intent,
    system: SYSTEM_PROMPT,
    workers: ["UI-COMPOSER", "EDGE-API", "AUTH-GUARD", "SELF-HEALER"],
    resumable: true,
  };
}
`;

export const SCENE_CONTRACT_TARGET = `export function resolveSortKey(input: string): SortKey {
  return input;
}`;

export const SCENE_CONTRACT_PATCH = `const SORT_KEYS: SortKey[] = ["agent", "status", "tokens", "startedAt"];

export function resolveSortKey(input: string): SortKey {
  if (SORT_KEYS.includes(input as SortKey)) return input as SortKey;
  return "agent";
}`;

const SCENE_CONTRACT = `export type SortKey = "agent" | "status" | "tokens" | "startedAt";

export interface AgentRun {
  agent: string;
  status: "queued" | "running" | "succeeded" | "failed";
  tokens: number;
  startedAt: string;
}

${SCENE_CONTRACT_TARGET}
`;

export const SOURCE_FILES = [
  {
    path: "components/SidebarNav.tsx",
    agent: "UI-COMPOSER",
    content: SIDEBAR_NAV,
  },
  {
    path: "components/DataGrid.tsx",
    agent: "UI-COMPOSER",
    content: DATA_GRID,
  },
  {
    path: "app/dashboard/page.tsx",
    agent: "UI-COMPOSER",
    content: DASHBOARD_PAGE,
  },
  {
    path: "app/api/agents/route.ts",
    agent: "EDGE-API",
    content: AGENTS_ROUTE,
  },
  {
    path: "agents/auth-guard.ts",
    agent: "AUTH-GUARD",
    content: AUTH_GUARD,
  },
  {
    path: "agents/orchestrator.ts",
    agent: "ORCHESTRATOR",
    content: ORCHESTRATOR,
  },
  {
    path: "lib/scene-contract.ts",
    agent: "SELF-HEALER",
    content: SCENE_CONTRACT,
  },
];

export function fixture(filePath) {
  const entry = SOURCE_FILES.find((file) => file.path === filePath);
  if (!entry) throw new Error("unknown fixture: " + filePath);
  return entry;
}
