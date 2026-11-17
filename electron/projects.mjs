/**
 * Project store for the Electron main process.
 *
 * A project is a single `.acm` file: a zip container with `acidmade.json` and
 * every resource. Existing folder projects (a directory with `acidmade.json`)
 * are still readable, so nothing created by an older build breaks.
 *
 * No Electron imports here, so the whole thing is testable with plain Node.
 */
import { randomBytes } from "node:crypto";
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

function normalizeEntryPath(value) {
  const cleaned = String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!cleaned) throw new Error("path is required");
  const parts = cleaned.split("/");
  if (parts.some((part) => part === "" || part === ".." || part === ".")) {
    throw new Error("invalid path");
  }
  return cleaned;
}

function starterContent(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".acid") {
    return (
      JSON.stringify(
        { acid: "1.0", root: "MainApp", class: "AppRoot", nodes: [], signals: {} },
        null,
        2,
      ) + "\n"
    );
  }
  if (extension === ".json") return "{}\n";
  if (extension === ".prompt") return "You are a helpful agent.\n";
  if (extension === ".md") return "# New document\n";
  return "";
}

function copyName(relative) {
  const slash = relative.lastIndexOf("/");
  const directory = slash >= 0 ? relative.slice(0, slash + 1) : "";
  const base = slash >= 0 ? relative.slice(slash + 1) : relative;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : "";
  return directory + stem + " copy" + extension;
}

function withManifest(entries, manifest) {
  const encoded = Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const index = entries.findIndex((entry) => entry.path === MANIFEST);
  if (index >= 0) entries[index] = { path: MANIFEST, data: encoded };
  else entries.unshift({ path: MANIFEST, data: encoded });
  return entries;
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

function tempPathFor(target) {
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
}

async function writeAndSync(filePath, data) {
  const handle = await fs.open(filePath, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Replaces a project file without ever exposing a partially written archive.
 *
 * The bytes go to a temporary file in the same directory, are flushed, and the
 * previous archive is copied to `<name>.acm.bak` before the temporary file is
 * renamed over the target. A crash leaves either the old file or the new one,
 * never a truncated one, and the rename is atomic within a filesystem.
 */
async function writeAcmFile(target, buffer) {
  const temp = tempPathFor(target);
  try {
    await writeAndSync(temp, buffer);
    const previous = await fs.readFile(target).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (previous) {
      const backup = target + ".bak";
      const backupTemp = tempPathFor(backup);
      try {
        await writeAndSync(backupTemp, previous);
        await fs.rename(backupTemp, backup);
      } finally {
        await fs.rm(backupTemp, { force: true }).catch(() => {});
      }
    }
    await fs.rename(temp, target);
    const directory = await fs.open(path.dirname(target), "r").catch(() => null);
    if (directory) {
      await directory.sync().catch(() => {});
      await directory.close().catch(() => {});
    }
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
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
      const stats = await fs.stat(path.join(directory, entry.name)).catch(() => null);
      out.push({
        path: relative,
        name: entry.name,
        kind: "dir",
        size: 0,
        mtime: stats ? stats.mtime.toISOString() : null,
      });
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
    .map(([entryPath, data]) => {
      if (entryPath.endsWith("/")) {
        const directory = entryPath.replace(/\/+$/, "");
        return {
          path: directory,
          name: directory.split("/").at(-1) ?? directory,
          kind: "dir",
          size: 0,
          language: "",
        };
      }
      return {
        path: entryPath,
        name: entryPath.split("/").at(-1) ?? entryPath,
        kind: "file",
        size: data.length,
        language: languageOf(entryPath),
      };
    })
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

    await writeAcmFile(filePath, writeAcm(entries));
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
        await writeAcmFile(resolved, writeAcm(entries));
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

  async function uniqueProjectPath(directory, base, ignore) {
    let target = path.join(directory, base + EXTENSION);
    if (ignore && path.resolve(target) === path.resolve(ignore)) return target;
    let suffix = 2;
    while (await fileExists(target)) {
      target = path.join(directory, base + "-" + suffix + EXTENSION);
      suffix += 1;
    }
    return target;
  }

  async function rename(projectPath, name) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved).catch(() => null);
    if (!stats || !stats.isFile() || !resolved.toLowerCase().endsWith(EXTENSION)) {
      throw new Error("only .acm project files can be renamed");
    }
    const clean = String(name ?? "").trim().slice(0, 120);
    if (!clean) throw new Error("project name is required");

    const target = await uniqueProjectPath(path.dirname(resolved), slugify(clean), resolved);
    const archive = await readArchive(resolved);
    const manifest =
      parseManifest(acmText(archive, MANIFEST) ?? "") ?? manifestDefaults(clean);
    const updated = {
      ...manifest,
      name: clean,
      slug: path.basename(target, EXTENSION),
      updatedAt: new Date().toISOString(),
    };
    const entries = withManifest(
      [...archive.entries()].map(([entryPath, data]) => ({ path: entryPath, data })),
      updated,
    );

    // Move first, then rewrite the manifest at the new path. A failed write
    // leaves the archive readable under its new name rather than half-renamed.
    if (target !== resolved) await fs.rename(resolved, target);
    await writeAcmFile(target, writeAcm(entries));
    return recordFromManifest(updated, target, entries.length, await fs.stat(target));
  }

  async function duplicate(projectPath) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved).catch(() => null);
    if (!stats || !stats.isFile() || !resolved.toLowerCase().endsWith(EXTENSION)) {
      throw new Error("only .acm project files can be duplicated");
    }

    const archive = await readArchive(resolved);
    const manifest = parseManifest(acmText(archive, MANIFEST) ?? "");
    const source = recordFromManifest(manifest, resolved, archive.size, stats);

    let copyName = source.name + " copy";
    let target = path.join(path.dirname(resolved), slugify(copyName) + EXTENSION);
    let suffix = 2;
    while (await fileExists(target)) {
      copyName = source.name + " copy " + suffix;
      target = path.join(path.dirname(resolved), slugify(copyName) + EXTENSION);
      suffix += 1;
    }

    const now = new Date().toISOString();
    const updated = {
      ...(manifest ?? manifestDefaults(copyName)),
      name: copyName,
      slug: path.basename(target, EXTENSION),
      createdAt: now,
      updatedAt: now,
    };
    const entries = withManifest(
      [...archive.entries()].map(([entryPath, data]) => ({ path: entryPath, data })),
      updated,
    );
    await writeAcmFile(target, writeAcm(entries));
    return recordFromManifest(updated, target, entries.length, await fs.stat(target));
  }

  async function remove(projectPath) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved).catch(() => null);
    if (!stats || !stats.isFile() || !resolved.toLowerCase().endsWith(EXTENSION)) {
      throw new Error("only .acm project files can be deleted");
    }
    await fs.unlink(resolved);
    // The atomic writer leaves a .bak beside the archive; deleting the project
    // should not leave a readable copy behind.
    await fs.rm(resolved + ".bak", { force: true });
    return { path: resolved };
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

    await writeAcmFile(resolved, writeAcm(entries));
    const fileStats = await fs.stat(resolved);
    return { size: payload.length, mtime: fileStats.mtime.toISOString() };
  }

  

  async function createEntry(projectPath, relative, options = {}) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved);
    const kind = options.kind === "dir" ? "dir" : "file";
    const target = normalizeEntryPath(relative);

    if (stats.isDirectory()) {
      const absolute = resolveInside(resolved, target);
      if (await fileExists(absolute)) throw new Error("already exists: " + target);
      if (kind === "dir") {
        await fs.mkdir(absolute, { recursive: false });
      } else {
        await fs.mkdir(path.dirname(absolute), { recursive: true });
        await fs.writeFile(absolute, options.content ?? starterContent(target), { flag: "wx" });
      }
      return { path: target, kind };
    }

    const archive = await readArchive(resolved);
    if (kind === "dir") {
      if (archive.has(target + "/")) throw new Error("already exists: " + target);
      archive.set(target + "/", Buffer.alloc(0));
    } else {
      if (archive.has(target)) throw new Error("already exists: " + target);
      archive.set(target, Buffer.from(options.content ?? starterContent(target), "utf8"));
    }

    const entries = [...archive.entries()].map(([entryPath, data]) => ({ path: entryPath, data }));
    const manifestEntry = entries.find((entry) => entry.path === MANIFEST);
    if (manifestEntry) {
      const manifest = parseManifest(String(manifestEntry.data)) ?? {};
      manifest.updatedAt = new Date().toISOString();
      manifestEntry.data = JSON.stringify(manifest, null, 2) + "\n";
    }
    await writeAcmFile(resolved, writeAcm(entries));
    return { path: target, kind };
  }

  async function renameEntry(projectPath, from, to) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved);
    const source = normalizeEntryPath(from);
    const target = normalizeEntryPath(to);
    if (source === target) return { path: target };

    if (stats.isDirectory()) {
      const absolute = resolveInside(resolved, source);
      const next = resolveInside(resolved, target);
      if (await fileExists(next)) throw new Error("already exists: " + target);
      await fs.mkdir(path.dirname(next), { recursive: true });
      await fs.rename(absolute, next);
      return { path: target };
    }

    const archive = await readArchive(resolved);
    const entries = [...archive.entries()].map(([entryPath, data]) => ({ path: entryPath, data }));
    const isFolder = archive.has(source + "/") || entries.some((entry) => entry.path.startsWith(source + "/"));
    const collides = isFolder
      ? entries.some((entry) => entry.path === target + "/" || entry.path.startsWith(target + "/"))
      : entries.some((entry) => entry.path === target);
    if (collides) throw new Error("already exists: " + target);
    if (!isFolder && !archive.has(source)) throw new Error("not found: " + source);

    const renamed = entries.map((entry) => {
      if (entry.path === source) return { ...entry, path: target };
      if (entry.path === source + "/") return { ...entry, path: target + "/" };
      if (entry.path.startsWith(source + "/")) {
        return { ...entry, path: target + entry.path.slice(source.length) };
      }
      return entry;
    });

    const manifestEntry = renamed.find((entry) => entry.path === MANIFEST);
    if (manifestEntry) {
      const manifest = parseManifest(String(manifestEntry.data)) ?? {};
      manifest.updatedAt = new Date().toISOString();
      manifestEntry.data = JSON.stringify(manifest, null, 2) + "\n";
    }
    await writeAcmFile(resolved, writeAcm(renamed));
    return { path: target, entries: renamed.length };
  }

  async function duplicateEntry(projectPath, relative) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved);
    const source = normalizeEntryPath(relative);
    const target = copyName(source);

    if (stats.isDirectory()) {
      const from = resolveInside(resolved, source);
      const to = resolveInside(resolved, target);
      if (await fileExists(to)) throw new Error("already exists: " + target);
      await fs.cp(from, to, { recursive: true });
      return { path: target };
    }

    const archive = await readArchive(resolved);
    const entries = [...archive.entries()].map(([entryPath, data]) => ({ path: entryPath, data }));
    const selected = entries.filter(
      (entry) =>
        entry.path === source ||
        entry.path === source + "/" ||
        entry.path.startsWith(source + "/"),
    );
    if (selected.length === 0) throw new Error("not found: " + source);
    if (entries.some((entry) => entry.path === target || entry.path.startsWith(target + "/"))) {
      throw new Error("already exists: " + target);
    }

    const copies = selected.map((entry) => ({
      path: target + entry.path.slice(source.length),
      data: Buffer.from(entry.data),
    }));
    const next = [...entries, ...copies];
    const manifestEntry = next.find((entry) => entry.path === MANIFEST);
    if (manifestEntry) {
      const manifest = parseManifest(String(manifestEntry.data)) ?? {};
      manifest.updatedAt = new Date().toISOString();
      manifestEntry.data = JSON.stringify(manifest, null, 2) + "\n";
    }
    await writeAcmFile(resolved, writeAcm(next));
    return { path: target, entries: copies.length };
  }

  async function deleteEntry(projectPath, relative) {
    const resolved = path.resolve(String(projectPath));
    const stats = await fs.stat(resolved);
    const target = normalizeEntryPath(relative);

    if (stats.isDirectory()) {
      const absolute = resolveInside(resolved, target);
      await fs.rm(absolute, { recursive: true, force: false });
      return { path: target };
    }

    const archive = await readArchive(resolved);
    const entries = [...archive.entries()].map(([entryPath, data]) => ({ path: entryPath, data }));
    const keep = entries.filter(
      (entry) =>
        entry.path !== target &&
        entry.path !== target + "/" &&
        !entry.path.startsWith(target + "/"),
    );
    if (keep.length === entries.length) throw new Error("not found: " + target);

    const manifestEntry = keep.find((entry) => entry.path === MANIFEST);
    if (manifestEntry) {
      const manifest = parseManifest(String(manifestEntry.data)) ?? {};
      manifest.updatedAt = new Date().toISOString();
      manifestEntry.data = JSON.stringify(manifest, null, 2) + "\n";
    }
    await writeAcmFile(resolved, writeAcm(keep));
    return { path: target, removed: entries.length - keep.length };
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
    createEntry,
    renameEntry,
    duplicateEntry,
    deleteEntry,
    rename,
    duplicate,
    remove,
  };
}
