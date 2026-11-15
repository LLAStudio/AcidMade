/**
 * Project store for the Electron main process.
 *
 * A project is a single `.acm` file: a zip container with `acidmade.json` and
 * every resource. Existing folder projects (a directory with `acidmade.json`)
 * are still readable, so nothing created by an older build breaks.
 *
 * No Electron imports here, so the whole thing is testable with plain Node.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { readAcm, text as acmText, writeAcm } from "./acm.mjs";

const MANIFEST = "acidmade.json";
const EXTENSION = ".acm";
const SKIP_DIRS = new Set(["node_modules", ".git", ".idea", ".vscode", "dist", "release", ".cache"]);
const MAX_READ = 2 * 1024 * 1024;

const LANGUAGES = {
  ".acid": "json",
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "ts",
  ".mjs": "ts",
  ".json": "json",
  ".md": "md",
  ".css": "css",
  ".prompt": "prompt",
  ".html": "html",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".txt": "text",
  ".svg": "svg",
};

export function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled-project"
  );
}

function languageOf(file) {
  return LANGUAGES[path.extname(file).toLowerCase()] ?? "text";
}

function resolveInside(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, relative);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error("path escapes project directory");
  }
  return target;
}

function sceneFor(template) {
  if (template === "agent") {
    return {
      acid: "1.0",
      root: "AgentMesh",
      class: "AppRoot",
      entry: "res://scenes/AgentMesh.acid",
      nodes: [
        { id: "agent-mesh", name: "AgentMesh", class: "AppRoot", kind: "root", parent: null },
        { id: "orchestrator", name: "Orchestrator", class: "SuperAgent", kind: "agent", parent: "agent-mesh" },
        { id: "researcher", name: "Researcher", class: "SuperAgent", kind: "agent", parent: "agent-mesh" },
        { id: "critic", name: "Critic", class: "SuperAgent", kind: "agent", parent: "agent-mesh" },
        { id: "bus", name: "SignalBus", class: "MessageBus", kind: "data", parent: "agent-mesh" },
      ],
      signals: { on_ready: ["Orchestrator.start"] },
    };
  }

  if (template === "blank") {
    return {
      acid: "1.0",
      root: "MainApp",
      class: "AppRoot",
      entry: "res://scenes/MainApp.acid",
      nodes: [{ id: "main-app", name: "MainApp", class: "AppRoot", kind: "root", parent: null }],
      signals: { on_ready: [] },
    };
  }

  return {
    acid: "1.0",
    root: "MainApp",
    class: "AppRoot",
    entry: "res://scenes/DashboardPage.acid",
    nodes: [
      { id: "main-app", name: "MainApp", class: "AppRoot", kind: "root", parent: null },
      { id: "workspace-shell", name: "WorkspaceShell", class: "LayoutShell", kind: "ui", parent: "main-app" },
      { id: "dashboard-page", name: "DashboardPage", class: "Screen", kind: "ui", parent: "workspace-shell" },
      { id: "metrics-grid", name: "MetricsGrid", class: "MetricGrid", kind: "component", parent: "dashboard-page" },
      { id: "live-feed-api", name: "LiveFeedAPI", class: "EdgeEndpoint", kind: "api", parent: "dashboard-page" },
      { id: "data-analyst", name: "DataAnalystAgent", class: "SuperAgent", kind: "agent", parent: "dashboard-page" },
    ],
    signals: {
      on_ready: ["WorkspaceShell.mount"],
      on_data_fetched: ["MetricsGrid.update"],
    },
  };
}

function templateMeta(template) {
  if (template === "agent") {
    return {
      name: "Agent workspace",
      scene: "res://scenes/AgentMesh.acid",
      summary: "Agent-first project: three super-agents sharing one signal bus.",
    };
  }
  if (template === "blank") {
    return {
      name: "Blank scene",
      scene: "res://scenes/MainApp.acid",
      summary: "One root node and one scene file.",
    };
  }
  return {
    name: "Analytics dashboard",
    scene: "res://scenes/MainApp.acid",
    summary: "Shell, dashboard, metric grid, streaming endpoint and one agent.",
  };
}

function manifestDefaults(name, template = "dashboard") {
  const meta = templateMeta(template);
  const now = new Date().toISOString();
  return {
    format: "acm/1.0",
    name,
    slug: slugify(name),
    branch: "main",
    environment: "Local",
    scene: meta.scene,
    template: meta.name,
    summary: meta.summary,
    createdAt: now,
    updatedAt: now,
  };
}

function parseManifest(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function countFolderFiles(directory, depth = 0) {
  if (depth > 4) return 0;
  let total = 0;
  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    if (entry.isDirectory()) total += await countFolderFiles(path.join(directory, entry.name), depth + 1);
    else total += 1;
  }
  return total;
}

async function folderFiles(directory, prefix = "", depth = 0, out = []) {
  if (depth > 6) return out;
  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      await folderFiles(path.join(directory, entry.name), relative, depth + 1, out);
      continue;
    }
    const stats = await fs.stat(path.join(directory, entry.name)).catch(() => null);
    if (!stats) continue;
    out.push({
      path: relative,
      name: entry.name,
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      language: languageOf(entry.name),
    });
  }
  return out;
}

function archiveFiles(entries) {
  return [...entries.entries()]
    .map(([entryPath, data]) => ({
      path: entryPath,
      name: entryPath.split("/").at(-1) ?? entryPath,
      size: data.length,
      language: languageOf(entryPath),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function createProjectStore({ rootDir, seed = true }) {
  const root = path.resolve(rootDir);

  async function ensureRoot() {
    await fs.mkdir(root, { recursive: true });
    return root;
  }

  async function readArchive(filePath) {
    const buffer = await fs.readFile(filePath);
    return readAcm(buffer);
  }

  function recordFromManifest(manifest, filePath, fileCount, stats) {
    const fallback = manifestDefaults(
      path.basename(filePath, path.extname(filePath))
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ") || "Untitled project",
    );
    const merged = { ...fallback, ...(manifest ?? {}) };
    const slug = merged.slug || slugify(path.basename(filePath, path.extname(filePath)));
    return {
      id: slug,
      name: merged.name,
      slug,
      branch: merged.branch ?? "main",
      environment: merged.environment ?? "Local",
      path: filePath,
      scene: merged.scene ?? "res://scenes/MainApp.acid",
      template: merged.template ?? "Blank scene",
      summary: merged.summary ?? "",
      createdAt: merged.createdAt ?? stats.birthtime.toISOString(),
      updatedAt: merged.updatedAt ?? stats.mtime.toISOString(),
      fileCount,
      format: merged.format ?? "acm/1.0",
    };
  }

  async function list() {
    await ensureRoot();
    const entries = await fs.readdir(root, { withFileTypes: true });
    const records = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;

      if (entry.isFile() && entry.name.toLowerCase().endsWith(EXTENSION)) {
        const filePath = path.join(root, entry.name);
        const stats = await fs.stat(filePath).catch(() => null);
        if (!stats) continue;
        try {
          const archive = await readArchive(filePath);
          const manifest = parseManifest(acmText(archive, MANIFEST) ?? "");
          records.push(recordFromManifest(manifest, filePath, archive.size, stats));
        } catch {
          // A file with the extension but a broken archive is skipped rather
          // than breaking the whole project list.
        }
        continue;
      }

      if (entry.isDirectory()) {
        const directory = path.join(root, entry.name);
        const manifestPath = path.join(directory, MANIFEST);
        if (!(await fileExists(manifestPath))) continue;
        const stats = await fs.stat(directory);
        const manifest = parseManifest(await fs.readFile(manifestPath, "utf8").catch(() => ""));
        const count = await countFolderFiles(directory);
        records.push(recordFromManifest(manifest, directory, count, stats));
      }
    }

    records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return records;
  }

  async function seedIfEmpty() {
    const projects = await list();
    if (projects.length > 0) return projects;
    await create({ name: "Northwind Analytics", template: "dashboard" });
    await create({ name: "Flux Console", template: "agent" });
    await create({ name: "AcidMade Core", template: "blank" });
    return list();
  }

  async function create({ name, template = "dashboard" }) {
    await ensureRoot();
    const clean = String(name ?? "").trim();
    if (!clean) throw new Error("project name is required");

    const base = slugify(clean);
    let filePath = path.join(root, base + EXTENSION);
    let suffix = 2;
    while (await fileExists(filePath)) {
      filePath = path.join(root, base + "-" + suffix + EXTENSION);
      suffix += 1;
    }

    const meta = templateMeta(template);
    const manifest = {
      ...manifestDefaults(clean, template),
      slug: path.basename(filePath, EXTENSION),
      template: meta.name,
      summary: meta.summary,
      scene: meta.scene,
    };

    const entries = [
      { path: MANIFEST, data: JSON.stringify(manifest, null, 2) + "\n" },
      { path: "scenes/MainApp.acid", data: JSON.stringify(sceneFor(template), null, 2) + "\n" },
    ];

    if (template === "agent") {
      entries.push({
        path: "scenes/AgentMesh.acid",
        data: JSON.stringify(sceneFor("agent"), null, 2) + "\n",
      });
      entries.push({
        path: "agents/Orchestrator.agent.ts",
        data: [
          'import type { AgentContext } from "@acidmade/engine";',
          "",
          'export const model = "claude-sonnet-4-6";',
          'export const autonomy = "Ask Permission";',
          "export const maxSteps = 20;",
          "",
          "export async function onRun(context: AgentContext) {",
          "  await context.inspectScene();",
          '  return context.report("agent mesh ready");',
          "}",
          "",
        ].join("\n"),
      });
    }

    if (template !== "blank") {
      entries.push({
        path: "acid.config.json",
        data: JSON.stringify({ acid: "1.0", accent: "#CCFF00", density: "engine", radius: 4 }, null, 2) + "\n",
      });
    }

    entries.push({
      path: "README.md",
      data: ["# " + clean, "", meta.summary, "", "Open this .acm file in AcidMade.", ""].join("\n"),
    });

    await fs.writeFile(filePath, writeAcm(entries));
    const stats = await fs.stat(filePath);
    return recordFromManifest(manifest, filePath, entries.length, stats);
  }

  async function open(target) {
    const resolved = path.resolve(String(target));
    const stats = await fs.stat(resolved).catch(() => null);
    if (!stats) throw new Error("project file not found");

    if (stats.isFile()) {
      if (!resolved.toLowerCase().endsWith(EXTENSION)) {
        throw new Error("not an AcidMade project (.acm)");
      }
      const archive = await readArchive(resolved);
      const manifest = parseManifest(acmText(archive, MANIFEST) ?? "");
      if (!manifest) {
        const created = manifestDefaults(path.basename(resolved, EXTENSION));
        const entries = [...archive.entries()].map(([entryPath, data]) => ({ path: entryPath, data }));
        entries.push({ path: MANIFEST, data: JSON.stringify(created, null, 2) + "\n" });
        await fs.writeFile(resolved, writeAcm(entries));
        return recordFromManifest(created, resolved, entries.length, await fs.stat(resolved));
      }
      return recordFromManifest(manifest, resolved, archive.size, stats);
    }

    // Legacy folder project.
    const manifestPath = path.join(resolved, MANIFEST);
    let manifest = parseManifest(await fs.readFile(manifestPath, "utf8").catch(() => ""));
    if (!manifest) {
      manifest = manifestDefaults(path.basename(resolved));
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    }
    const count = await countFolderFiles(resolved);
    return recordFromManifest(manifest, resolved, count, stats);
  }

  async function tree(projectPath) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved).catch(() => null);
    if (!stats) throw new Error("project not found");
    if (stats.isDirectory()) return folderFiles(resolved);
    return archiveFiles(await readArchive(resolved));
  }

  async function readFile(projectPath, relative) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved);
    if (stats.isDirectory()) {
      const target = resolveInside(resolved, relative);
      const fileStats = await fs.stat(target);
      if (!fileStats.isFile()) throw new Error("not a file");
      if (fileStats.size > MAX_READ) throw new Error("file is larger than 2 MB");
      return {
        content: await fs.readFile(target, "utf8"),
        size: fileStats.size,
        mtime: fileStats.mtime.toISOString(),
        language: languageOf(target),
      };
    }

    const archive = await readArchive(resolved);
    const entryPath = String(relative).replace(/\\/g, "/").replace(/^\/+/, "");
    const data = archive.get(entryPath);
    if (!data) throw new Error("file not found in project");
    if (data.length > MAX_READ) throw new Error("file is larger than 2 MB");
    return {
      content: data.toString("utf8"),
      size: data.length,
      mtime: stats.mtime.toISOString(),
      language: languageOf(entryPath),
    };
  }

  async function writeFile(projectPath, relative, content) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved);
    const body = String(content ?? "");

    if (stats.isDirectory()) {
      const target = resolveInside(resolved, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, body, "utf8");
      const fileStats = await fs.stat(target);
      const manifestPath = path.join(resolved, MANIFEST);
      const manifest = parseManifest(await fs.readFile(manifestPath, "utf8").catch(() => ""));
      if (manifest) {
        manifest.updatedAt = new Date().toISOString();
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
      }
      return { size: fileStats.size, mtime: fileStats.mtime.toISOString() };
    }

    const archive = await readArchive(resolved);
    const entryPath = String(relative).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!entryPath || entryPath.includes("..")) throw new Error("invalid entry path");

    const entries = [...archive.entries()].map(([path_, data]) => ({ path: path_, data }));
    const manifestEntry = entries.find((entry) => entry.path === MANIFEST);
    if (manifestEntry) {
      const manifest = parseManifest(String(manifestEntry.data)) ?? {};
      manifest.updatedAt = new Date().toISOString();
      manifestEntry.data = JSON.stringify(manifest, null, 2) + "\n";
    }

    const payload = Buffer.from(body, "utf8");
    const existing = entries.find((entry) => entry.path === entryPath);
    if (existing) existing.data = payload;
    else entries.push({ path: entryPath, data: payload });

    await fs.writeFile(resolved, writeAcm(entries));
    const fileStats = await fs.stat(resolved);
    return { size: payload.length, mtime: fileStats.mtime.toISOString() };
  }

  return {
    root,
    ensureRoot,
    seedIfEmpty,
    list,
    create,
    open,
    tree,
    readFile,
    writeFile,
  };
}
