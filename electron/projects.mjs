/**
 * On-disk project store.
 *
 * Deliberately free of Electron imports so it can be tested with plain Node.
 * Every path that comes from the renderer is resolved and checked to stay
 * inside the project directory.
 */
import fs from "node:fs/promises";
import path from "node:path";

const MANIFEST = "acidmade.json";
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

function manifestDefaults(directoryName, template = "dashboard") {
  const meta = templateMeta(template);
  const now = new Date().toISOString();
  return {
    name: directoryName
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    slug: slugify(directoryName),
    branch: "main",
    environment: "Local",
    scene: meta.scene,
    template: meta.name,
    summary: meta.summary,
    createdAt: now,
    updatedAt: now,
  };
}

async function readManifest(directory) {
  try {
    const raw = await fs.readFile(path.join(directory, MANIFEST), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function toRecord(directory, manifest) {
  const stats = await fs.stat(directory);
  const fallback = manifestDefaults(path.basename(directory));
  const merged = { ...fallback, ...(manifest ?? {}) };
  const count = await countFiles(directory);
  return {
    id: merged.slug || slugify(path.basename(directory)),
    name: merged.name,
    slug: merged.slug || slugify(path.basename(directory)),
    branch: merged.branch ?? "main",
    environment: merged.environment ?? "Local",
    path: directory,
    scene: merged.scene ?? "res://scenes/MainApp.acid",
    template: merged.template ?? "Blank scene",
    summary: merged.summary ?? "",
    createdAt: merged.createdAt ?? stats.birthtime.toISOString(),
    updatedAt: merged.updatedAt ?? stats.mtime.toISOString(),
    fileCount: count,
  };
}

async function countFiles(directory, depth = 0) {
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
    if (entry.isDirectory()) total += await countFiles(path.join(directory, entry.name), depth + 1);
    else total += 1;
  }
  return total;
}

export function createProjectStore({ rootDir, seed = true }) {
  const root = path.resolve(rootDir);

  async function ensureRoot() {
    await fs.mkdir(root, { recursive: true });
    return root;
  }

  async function seedIfEmpty() {
    const projects = await list();
    if (projects.length > 0) return projects;

    await create({ name: "Northwind Analytics", template: "dashboard" });
    await create({ name: "Flux Console", template: "agent" });
    await create({ name: "AcidMade Core", template: "blank" });
    return list();
  }

  async function list() {
    await ensureRoot();
    const entries = await fs.readdir(root, { withFileTypes: true });
    const records = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const directory = path.join(root, entry.name);
      const manifest = await readManifest(directory);
      // Only directories that look like projects are listed.
      if (!manifest && !(await hasScene(directory))) continue;
      records.push(await toRecord(directory, manifest));
    }
    records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return records;
  }

  async function hasScene(directory) {
    try {
      const entries = await fs.readdir(path.join(directory, "scenes"));
      return entries.some((file) => file.endsWith(".acid"));
    } catch {
      return false;
    }
  }

  async function uniqueDirectory(name) {
    const base = slugify(name);
    let candidate = path.join(root, base);
    let suffix = 2;
    for (;;) {
      try {
        await fs.access(candidate);
        candidate = path.join(root, base + "-" + suffix);
        suffix += 1;
      } catch {
        return candidate;
      }
    }
  }

  async function create({ name, template = "dashboard" }) {
    await ensureRoot();
    const clean = String(name ?? "").trim();
    if (!clean) throw new Error("project name is required");

    const directory = await uniqueDirectory(clean);
    await fs.mkdir(directory, { recursive: true });

    const created = manifestDefaults(path.basename(directory), template);
    created.name = clean;
    const manifest = {
      ...created,
      slug: path.basename(directory),
      template: templateMeta(template).name,
      summary: templateMeta(template).summary,
      scene: templateMeta(template).scene,
    };
    await writeJson(path.join(directory, MANIFEST), manifest);
    await writeJson(path.join(directory, "scenes", "MainApp.acid"), sceneFor(template));

    if (template === "agent") {
      await writeJson(path.join(directory, "scenes", "AgentMesh.acid"), sceneFor("agent"));
      await fs.mkdir(path.join(directory, "agents"), { recursive: true });
      await fs.writeFile(
        path.join(directory, "agents", "Orchestrator.agent.ts"),
        [
          'import type { AgentContext } from "@acidmade/engine";',
          "",
          "export const model = \"claude-sonnet-4-6\";",
          "export const autonomy = \"Ask Permission\";",
          "export const maxSteps = 20;",
          "",
          "export async function onRun(context: AgentContext) {",
          "  await context.inspectScene();",
          "  return context.report(\"agent mesh ready\");",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );
    }

    if (template !== "blank") {
      await writeJson(path.join(directory, "acid.config.json"), {
        acid: "1.0",
        accent: "#CCFF00",
        density: "engine",
        radius: 4,
      });
    }

    await fs.writeFile(
      path.join(directory, "README.md"),
      [
        "# " + clean,
        "",
        manifest.summary,
        "",
        "Open this folder in AcidMade to edit the scene and its resources.",
        "",
      ].join("\n"),
      "utf8",
    );

    return toRecord(directory, manifest);
  }

  async function open(directory) {
    const resolved = path.resolve(String(directory));
    const stats = await fs.stat(resolved).catch(() => null);
    if (!stats || !stats.isDirectory()) throw new Error("not a directory");

    let manifest = await readManifest(resolved);
    if (!manifest) {
      manifest = manifestDefaults(path.basename(resolved));
      await writeJson(path.join(resolved, MANIFEST), manifest);
    }
    return toRecord(resolved, manifest);
  }

  async function tree(projectPath) {
    const base = path.resolve(String(projectPath));
    const files = [];

    async function walk(directory, prefix, depth) {
      if (depth > 6) return;
      let entries = [];
      try {
        entries = await fs.readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
        const relative = prefix ? prefix + "/" + entry.name : entry.name;
        if (entry.isDirectory()) {
          await walk(path.join(directory, entry.name), relative, depth + 1);
          continue;
        }
        const stats = await fs.stat(path.join(directory, entry.name)).catch(() => null);
        if (!stats) continue;
        files.push({
          path: relative,
          name: entry.name,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          language: languageOf(entry.name),
        });
      }
    }

    await walk(base, "", 0);
    return files;
  }

  async function readFile(projectPath, relative) {
    const target = resolveInside(projectPath, relative);
    const stats = await fs.stat(target);
    if (!stats.isFile()) throw new Error("not a file");
    if (stats.size > MAX_READ) throw new Error("file is larger than 2 MB");
    const content = await fs.readFile(target, "utf8");
    return {
      content,
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      language: languageOf(target),
    };
  }

  async function writeFile(projectPath, relative, content) {
    const target = resolveInside(projectPath, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, String(content ?? ""), "utf8");
    const stats = await fs.stat(target);

    const manifestPath = path.join(path.resolve(projectPath), MANIFEST);
    const manifest = await readManifest(path.resolve(projectPath));
    if (manifest) {
      manifest.updatedAt = new Date().toISOString();
      await writeJson(manifestPath, manifest);
    }

    return { size: stats.size, mtime: stats.mtime.toISOString() };
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
