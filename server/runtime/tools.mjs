import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import * as esbuild from "esbuild";

export const PROJECT_ROOT = path.resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);

export const TSC_PATH = path.join(
  PROJECT_ROOT,
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);

export function hasTypescript() {
  return existsSync(TSC_PATH);
}

export function countLines(content) {
  if (!content) return 0;
  return content.replace(/\n$/, "").split("\n").length;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " kB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

function resolveInside(workspace, relativePath) {
  const root = path.resolve(workspace);
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("path escapes the run workspace: " + relativePath);
  }
  return target;
}

export async function writeWorkspaceFile(workspace, relativePath, content) {
  const target = resolveInside(workspace, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");

  return {
    path: relativePath,
    bytes: Buffer.byteLength(content),
    lines: countLines(content),
  };
}

export async function readWorkspaceFile(workspace, relativePath) {
  const target = resolveInside(workspace, relativePath);
  return fs.readFile(target, "utf8");
}

export async function listFilesRecursive(directory) {
  const root = path.resolve(directory);
  const results = [];

  async function walk(current, prefix) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relative = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isDirectory()) await walk(path.join(current, entry.name), relative);
      else if (entry.isFile()) results.push(relative);
    }
  }

  await walk(root, "");
  return results.sort();
}

export async function transformWorkspaceFile(workspace, relativePath, content) {
  const started = performance.now();
  const loader = relativePath.endsWith(".tsx") ? "tsx" : "ts";
  const result = await esbuild.transform(content, {
    loader,
    format: "esm",
    target: "es2022",
    sourcefile: relativePath,
    logLevel: "silent",
  });

  return {
    bytes: Buffer.byteLength(result.code),
    durationMs: Math.max(1, Math.round(performance.now() - started)),
    warnings: result.warnings.length,
  };
}

export async function buildWorkspace(workspace, entryPoints) {
  const started = performance.now();
  const result = await esbuild.build({
    absWorkingDir: workspace,
    entryPoints,
    outdir: "dist",
    bundle: false,
    platform: "neutral",
    format: "esm",
    target: "es2022",
    loader: { ".ts": "ts", ".tsx": "tsx" },
    write: true,
    logLevel: "silent",
    metafile: true,
    color: false,
  });

  const outputs = Object.entries(result.metafile?.outputs ?? {});
  const bytes = outputs.reduce((sum, [, output]) => sum + (output.bytes ?? 0), 0);

  return {
    durationMs: Math.round(performance.now() - started),
    bytes,
    outputs: outputs.length,
    files: outputs.map(([file]) => file),
    warnings: result.warnings.map((warning) => warning.text),
  };
}

function runProcess(command, args, { cwd, signal }) {
  return new Promise((resolve, reject) => {
    const started = performance.now();

    execFile(
      command,
      args,
      {
        cwd,
        signal,
        timeout: 30000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error && error.name === "AbortError") {
          reject(error);
          return;
        }

        if (error && error.code === "ENOENT") {
          reject(new Error("tool binary not found: " + command));
          return;
        }

        const code =
          error && typeof error.code === "number"
            ? error.code
            : error
              ? 1
              : 0;

        resolve({
          code,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          durationMs: Math.round(performance.now() - started),
        });
      },
    );
  });
}

export async function typecheckWorkspace(workspace, signal) {
  return runProcess(
    process.execPath,
    [TSC_PATH, "-p", "tsconfig.json", "--pretty", "false"],
    { cwd: workspace, signal },
  );
}

export async function stageArtifact(workspace, sourceWorkspace, meta) {
  const sourceDist = path.join(sourceWorkspace, "dist");
  const files = await listFilesRecursive(sourceDist);

  if (files.length === 0) {
    throw new Error("no build artifacts available to stage");
  }

  const payload = {
    ...meta,
    createdAt: new Date().toISOString(),
    files: [],
  };

  for (const file of files) {
    const content = await fs.readFile(path.join(sourceDist, file));
    payload.files.push({
      path: file,
      bytes: content.byteLength,
      sha1: sha1(content),
      content: content.toString("base64"),
    });
  }

  const json = JSON.stringify(payload);
  const gzipped = zlib.gzipSync(Buffer.from(json), { level: 9 });
  const deployDir = path.join(workspace, "deploy");
  await fs.mkdir(deployDir, { recursive: true });

  const artifactName = "bundle.json.gz";
  await fs.writeFile(path.join(deployDir, artifactName), gzipped);

  const manifest = {
    project: meta.project,
    sourceRunId: meta.sourceRunId,
    artifact: artifactName,
    files: files.length,
    rawBytes: Buffer.byteLength(json),
    gzipBytes: gzipped.byteLength,
    sha1: sha1(gzipped),
    createdAt: new Date().toISOString(),
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  await fs.writeFile(path.join(deployDir, "manifest.json"), manifestText, "utf8");

  return {
    manifest,
    manifestText,
    rawBytes: manifest.rawBytes,
    gzipBytes: manifest.gzipBytes,
    fileCount: files.length,
  };
}
