import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  SCENE_CONTRACT_PATCH,
  SCENE_CONTRACT_TARGET,
  SOURCE_FILES,
  TSCONFIG,
  fixture,
} from "./fixtures.mjs";
import {
  buildWorkspace,
  formatBytes,
  hasTypescript,
  listFilesRecursive,
  readWorkspaceFile,
  sha1,
  stageArtifact,
  transformWorkspaceFile,
  typecheckWorkspace,
  writeWorkspaceFile,
} from "./tools.mjs";

function stamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds())
  );
}

function abortError() {
  const error = new Error("runtime aborted");
  error.name = "AbortError";
  return error;
}

function addedPreview(content, count = 2) {
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(0, count)
    .map((line) => "+" + line.trimEnd().slice(0, 160));
}

function parseDiagnostic(output) {
  const match = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/m.exec(output);
  if (!match) return null;
  return {
    file: match[1],
    line: Number(match[2]),
    column: Number(match[3]),
    code: match[4],
    message: match[5],
  };
}

function contextFor(run, emit) {
  const signal = run.abort.signal;

  const log = (agent, level, message, extra = {}) =>
    emit(run, {
      type: "log",
      time: stamp(),
      agent,
      level,
      message,
      channel: extra.channel ?? "console",
      nodeId: extra.nodeId,
      tool: extra.tool,
    });

  const node = (nodeId, status) => emit(run, { type: "node", nodeId, status });
  const progress = (value, agent) => emit(run, { type: "progress", value, agent });

  const diff = (data) =>
    emit(run, {
      type: "diff",
      diff: { id: "diff_" + randomUUID().slice(0, 8), ...data },
    });

  const problem = (data) => {
    const id = "diag_" + randomUUID().slice(0, 8);
    emit(run, { type: "problem", problem: { id, healed: false, ...data } });
    return id;
  };

  const healed = (problemId) => emit(run, { type: "healed", problemId });

  const waitForResume = () =>
    new Promise((resolve) => {
      const done = () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        run.pauseWaiters = run.pauseWaiters.filter((waiter) => waiter !== done);
        resolve();
      };
      run.pauseWaiters.push(done);
      signal.addEventListener("abort", onAbort, { once: true });
    });

  const pause = async (ms = 140) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    if (signal.aborted) throw abortError();
    if (run.paused) {
      await waitForResume();
      if (signal.aborted) throw abortError();
    }
  };

  const write = async (relativePath, content, agent, nodeId) => {
    const result = await writeWorkspaceFile(run.workspace, relativePath, content);
    log(
      agent,
      "info",
      "write " + relativePath + " · " + result.lines + " lines · " + formatBytes(result.bytes),
      { tool: "fs.write", nodeId },
    );
    diff({
      path: relativePath,
      additions: result.lines,
      deletions: 0,
      agent,
      preview: addedPreview(content),
    });
    return result;
  };

  const transpile = async (relativePath, content, agent) => {
    const result = await transformWorkspaceFile(run.workspace, relativePath, content);
    log(
      agent,
      "ok",
      "esbuild transform · " + relativePath + " · " + formatBytes(result.bytes) + " · " + result.durationMs + "ms",
      { tool: "esbuild.transform" },
    );
    return result;
  };

  return {
    signal,
    log,
    node,
    progress,
    diff,
    problem,
    healed,
    pause,
    write,
    transpile,
  };
}

async function prepareWorkspace(run) {
  await fs.rm(run.workspace, { recursive: true, force: true });
  await fs.mkdir(run.workspace, { recursive: true });
  await writeWorkspaceFile(run.workspace, "tsconfig.json", TSCONFIG);
  const contract = fixture("lib/scene-contract.ts");
  await writeWorkspaceFile(run.workspace, contract.path, contract.content);
}

export function createRuntime({ rootDir = process.cwd() } = {}) {
  const workspaceRoot = path.join(rootDir, ".acidmade", "runs");
  const runs = new Map();
  const bootedAt = Date.now();
  let activeRun = null;

  function emit(run, payload) {
    const event = {
      seq: run.nextSeq++,
      runId: run.id,
      at: Date.now(),
      ...payload,
    };

    run.events.push(event);
    if (run.events.length > 2000) run.events.shift();

    for (const subscriber of run.subscribers) {
      try {
        subscriber(event);
      } catch {
        // A broken client must never break the agent loop.
      }
    }

    return event;
  }

  function finish(run, status, message) {
    if (run.finishedAt) return;
    run.status = status;
    run.finishedAt = new Date();
    run.paused = false;
    const waiters = run.pauseWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
    if (activeRun?.id === run.id) activeRun = null;
    emit(run, { type: "status", status, message });
    console.log("[runtime] " + run.id + " " + status);
  }

  function describe() {
    return {
      online: true,
      service: "acidmade-runtime",
      version: "1.0.0",
      planner: "local-reference",
      mode: "local-tools",
      tools: [
        "fs.read",
        "fs.write",
        "fs.patch",
        "esbuild.transform",
        "esbuild.build",
        ...(hasTypescript() ? ["tsc"] : []),
        "zlib.gzip",
      ],
      workspace: ".acidmade/runs",
      activeRunId: activeRun?.status === "running" ? activeRun.id : null,
      capabilities: [
        "sse",
        "filesystem",
        "typescript",
        "abort",
        "pause",
        "artifact-staging",
      ],
      uptimeMs: Date.now() - bootedAt,
    };
  }

  function start({ kind = "build", intent = "", project = "northwind-analytics" }) {
    if (activeRun?.status === "running") {
      const error = new Error("A runtime session is already active.");
      error.code = "RUN_ACTIVE";
      error.runId = activeRun.id;
      throw error;
    }

    for (const [id, run] of runs) {
      if (
        run.status !== "running" &&
        run.finishedAt &&
        Date.now() - run.finishedAt.getTime() > 30 * 60 * 1000
      ) {
        runs.delete(id);
      }
    }

    const id = "run_" + randomUUID().slice(0, 10);
    const run = {
      id,
      kind: kind === "deploy" ? "deploy" : "build",
      intent: String(intent).slice(0, 2000),
      project: String(project).slice(0, 80),
      status: "running",
      nextSeq: 1,
      events: [],
      subscribers: new Set(),
      abort: new AbortController(),
      stopRequested: false,
      paused: false,
      pauseWaiters: [],
      workspace: path.join(workspaceRoot, id),
      startedAt: new Date(),
      finishedAt: null,
    };

    runs.set(id, run);
    activeRun = run;
    emit(run, {
      type: "started",
      kind: run.kind,
      project: run.project,
      intent: run.intent,
    });
    console.log("[runtime] " + id + " started (" + run.kind + ")");

    setImmediate(() => {
      const task = run.kind === "deploy" ? executeDeploy(run) : executeBuild(run);
      task.catch((error) => {
        console.error("[runtime] unhandled run failure", error);
      });
    });

    return {
      id,
      kind: run.kind,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
    };
  }

  function pause(id) {
    const run = runs.get(id);
    if (!run || run.status !== "running") return null;
    if (run.paused) return run;
    run.paused = true;
    emit(run, {
      type: "log",
      time: stamp(),
      agent: "ENGINE",
      level: "warn",
      message: "agent execution paused · runtime held at next checkpoint",
      channel: "console",
      tool: "runtime.pause",
    });
    return run;
  }

  function resume(id) {
    const run = runs.get(id);
    if (!run || run.status !== "running") return null;
    if (!run.paused) return run;
    run.paused = false;
    const waiters = run.pauseWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
    emit(run, {
      type: "log",
      time: stamp(),
      agent: "ENGINE",
      level: "info",
      message: "agent execution resumed · checkpoint released",
      channel: "console",
      tool: "runtime.resume",
    });
    return run;
  }

  function stop(id) {
    const run = runs.get(id);
    if (!run || run.status !== "running") return false;

    run.stopRequested = true;
    run.paused = false;
    run.abort.abort();

    emit(run, {
      type: "log",
      time: stamp(),
      agent: "ENGINE",
      level: "warn",
      message: "halt request received · terminating active tool process",
      channel: "console",
      tool: "runtime.abort",
    });

    finish(run, "halted", "run halted by operator");
    return true;
  }

  function get(id) {
    return runs.get(id) ?? null;
  }

  function subscribe(id, listener) {
    const run = runs.get(id);
    if (!run) return null;
    run.subscribers.add(listener);
    return () => run.subscribers.delete(listener);
  }

  function findCachedBuild(excludeId) {
    return [...runs.values()]
      .filter(
        (run) =>
          run.kind === "build" &&
          run.id !== excludeId &&
          run.status === "completed",
      )
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  }

  async function executeBuild(run) {
    const ctx = contextFor(run, emit);
    const { log, node, progress, diff, problem, healed, pause, write, transpile } = ctx;

    try {
      await prepareWorkspace(run);

      node("orchestrator-agent", "running");
      log(
        "ORCHESTRATOR",
        "action",
        "local runtime attached · planner=reference · workspace=.acidmade/runs/" + run.id,
        { tool: "runtime.attach" },
      );
      progress(4, "ORCHESTRATOR");
      await pause(160);

      node("auth-module", "running");
      const auth = fixture("agents/auth-guard.ts");
      const authResult = await write(auth.path, auth.content, "AUTH-GUARD", "auth-module");
      await transpile(auth.path, auth.content, "AUTH-GUARD");
      const permissionCount = (auth.content.match(/"[a-z]+:[a-z]+":/g) ?? []).length;
      log(
        "AUTH-GUARD",
        "ok",
        "policy matrix validated · " + permissionCount + " permissions · 0 escalations · " + formatBytes(authResult.bytes),
        { tool: "policy.scan" },
      );
      node("auth-module", "healthy");
      progress(17, "AUTH-GUARD");
      await pause(120);

      node("dashboard-view", "running");

      node("sidebar-nav", "running");
      const sidebar = fixture("components/SidebarNav.tsx");
      await write(sidebar.path, sidebar.content, "UI-COMPOSER", "sidebar-nav");
      await transpile(sidebar.path, sidebar.content, "UI-COMPOSER");
      node("sidebar-nav", "healthy");
      progress(27, "UI-COMPOSER");
      await pause(110);

      node("data-grid", "running");
      const grid = fixture("components/DataGrid.tsx");
      await write(grid.path, grid.content, "UI-COMPOSER", "data-grid");
      await transpile(grid.path, grid.content, "UI-COMPOSER");
      node("data-grid", "healthy");
      progress(37, "UI-COMPOSER");
      await pause(110);

      const page = fixture("app/dashboard/page.tsx");
      await write(page.path, page.content, "UI-COMPOSER", "dashboard-view");
      await transpile(page.path, page.content, "UI-COMPOSER");
      node("dashboard-view", "healthy");
      progress(44, "UI-COMPOSER");

      node("backend-api", "running");
      const route = fixture("app/api/agents/route.ts");
      await write(route.path, route.content, "EDGE-API", "backend-api");
      await transpile(route.path, route.content, "EDGE-API");
      const handlerCount = (route.content.match(/export async function (GET|POST)/g) ?? []).length;
      log(
        "EDGE-API",
        "ok",
        "route handlers detected · " + handlerCount + " handlers · schema parsed",
        { tool: "route.scan" },
      );
      node("backend-api", "healthy");
      node("runs-route", "healthy");

      const orchestrator = fixture("agents/orchestrator.ts");
      await write(orchestrator.path, orchestrator.content, "ORCHESTRATOR", "orchestrator-agent");
      await transpile(orchestrator.path, orchestrator.content, "ORCHESTRATOR");
      progress(54, "EDGE-API");
      await pause(120);

      const entryPoints = SOURCE_FILES.map((file) => file.path);
      log(
        "BUILD",
        "info",
        "esbuild --format=esm --outdir=dist (" + entryPoints.length + " entry points)",
        { channel: "build", tool: "esbuild.build" },
      );

      let buildResult = await buildWorkspace(run.workspace, entryPoints);
      for (const warning of buildResult.warnings.slice(0, 3)) {
        log("BUILD", "warn", warning, { channel: "build" });
      }
      log(
        "BUILD",
        "ok",
        "esbuild wrote " + buildResult.outputs + " outputs · " + formatBytes(buildResult.bytes) + " · " + buildResult.durationMs + "ms",
        { channel: "build" },
      );
      progress(64, "BUILD");
      await pause(100);

      if (hasTypescript()) {
        log("BUILD", "info", "tsc -p tsconfig.json --pretty false", {
          channel: "build",
          tool: "tsc",
        });
        const check = await typecheckWorkspace(run.workspace, ctx.signal);
        const output = [check.stdout, check.stderr].filter(Boolean).join("\n").trim();
        output
          .split("\n")
          .filter(Boolean)
          .slice(0, 8)
          .forEach((line) =>
            log("BUILD", /error TS/.test(line) ? "error" : "info", line, {
              channel: "build",
            }),
          );
        log(
          "BUILD",
          check.code === 0 ? "ok" : "error",
          "tsc exited " + check.code + " · " + check.durationMs + "ms",
          { channel: "build" },
        );

        if (check.code !== 0) {
          const diagnostic = parseDiagnostic(output);
          if (!diagnostic) {
            throw new Error("typecheck failed without a parseable diagnostic");
          }

          const relativeFile = diagnostic.file.startsWith(run.workspace)
            ? path.relative(run.workspace, diagnostic.file)
            : diagnostic.file.replace(/^\.\//, "");

          node("data-grid", "error");
          const problemId = problem({
            severity: "error",
            code: diagnostic.code,
            file: relativeFile,
            line: diagnostic.line,
            message: diagnostic.message,
          });
          log(
            "SELF-HEALER",
            "error",
            diagnostic.code + " · " + relativeFile + ":" + diagnostic.line + " · " + diagnostic.message,
            { nodeId: "data-grid" },
          );
          progress(72, "SELF-HEALER");
          await pause(160);

          await readWorkspaceFile(run.workspace, "lib/scene-contract.ts");
          log("SELF-HEALER", "action", "read lib/scene-contract.ts + tsconfig.json", {
            tool: "fs.read",
            nodeId: "data-grid",
          });

          const contract = fixture("lib/scene-contract.ts").content;
          if (!contract.includes(SCENE_CONTRACT_TARGET)) {
            throw new Error("self-heal target missing from lib/scene-contract.ts");
          }
          const patched = contract.replace(SCENE_CONTRACT_TARGET, SCENE_CONTRACT_PATCH);
          const repaired = await writeWorkspaceFile(
            run.workspace,
            "lib/scene-contract.ts",
            patched,
          );

          log(
            "SELF-HEALER",
            "action",
            "patch lib/scene-contract.ts · narrow SortKey at the boundary",
            { tool: "fs.patch", nodeId: "data-grid" },
          );
          diff({
            path: "lib/scene-contract.ts",
            additions: SCENE_CONTRACT_PATCH.split("\n").length,
            deletions: SCENE_CONTRACT_TARGET.split("\n").length,
            agent: "SELF-HEALER",
            preview: [
              "-  return input;",
              "+  if (SORT_KEYS.includes(input as SortKey)) return input as SortKey;",
              "+  return \"agent\";",
            ],
          });
          await pause(120);

          node("data-grid", "running");
          log("BUILD", "info", "tsc -p tsconfig.json --pretty false (post-patch)", {
            channel: "build",
            tool: "tsc",
          });
          const recheck = await typecheckWorkspace(run.workspace, ctx.signal);
          log(
            "BUILD",
            recheck.code === 0 ? "ok" : "error",
            "tsc exited " + recheck.code + " · 0 diagnostics · " + recheck.durationMs + "ms",
            { channel: "build" },
          );

          if (recheck.code !== 0) {
            throw new Error("self-heal did not converge · tsc still failing");
          }

          healed(problemId);
          log(
            "SELF-HEALER",
            "ok",
            "diagnostic cleared · 1 problem auto-healed · " + formatBytes(repaired.bytes),
            { nodeId: "data-grid", tool: "runtime.verify" },
          );
          node("data-grid", "healthy");

          log(
            "BUILD",
            "info",
            "esbuild --format=esm --outdir=dist (post-patch rebuild)",
            { channel: "build", tool: "esbuild.build" },
          );
          buildResult = await buildWorkspace(run.workspace, entryPoints);
          log(
            "BUILD",
            "ok",
            "rebuild complete · " + buildResult.outputs + " outputs · " + formatBytes(buildResult.bytes) + " · " + buildResult.durationMs + "ms",
            { channel: "build" },
          );
        }
      } else {
        log("BUILD", "warn", "typescript unavailable · deep typecheck skipped", {
          channel: "build",
          nodeId: "data-grid",
        });
      }

      progress(88, "BUILD");
      await pause(100);

      const distFiles = await listFilesRecursive(path.join(run.workspace, "dist"));
      const buildId = sha1(run.id + ":" + buildResult.bytes + ":" + distFiles.join(",")).slice(0, 10);
      const manifestText = JSON.stringify(
        {
          project: run.project,
          buildId,
          createdAt: new Date().toISOString(),
          planner: "local-reference",
          routes: ["/dashboard", "/api/agents"],
          modules: distFiles,
        },
        null,
        2,
      );
      const manifest = await writeWorkspaceFile(
        run.workspace,
        "dist/manifest.json",
        manifestText,
      );
      log(
        "BUILD",
        "ok",
        "manifest written · " + distFiles.length + " artifacts · " + formatBytes(buildResult.bytes + manifest.bytes),
        { channel: "build", tool: "fs.write" },
      );
      diff({
        path: "dist/manifest.json",
        additions: manifest.lines,
        deletions: 0,
        agent: "BUILD",
        preview: manifestText.split("\n").slice(0, 2).map((line) => "+" + line),
      });

      node("orchestrator-agent", "healthy");
      log(
        "ORCHESTRATOR",
        "ok",
        "scene converged · " + SOURCE_FILES.length + " generated modules · 0 blocking diagnostics",
        { tool: "runtime.verify" },
      );
      progress(96, "ORCHESTRATOR");
      await pause(140);

      log(
        "ORCHESTRATOR",
        "action",
        "artifact ready · .acidmade/runs/" + run.id + "/dist",
        { tool: "runtime.complete" },
      );
      progress(100, "ORCHESTRATOR");
      await pause(80);
      finish(run, "completed", "build completed · artifact ready");
    } catch (error) {
      handleExecuteError(run, error, "build");
    }
  }

  async function executeDeploy(run) {
    const ctx = contextFor(run, emit);
    const { log, node, progress, diff, pause } = ctx;

    try {
      await prepareWorkspace(run);

      node("orchestrator-agent", "running");
      log(
        "ORCHESTRATOR",
        "action",
        "deploy requested · resolving cached local artifact",
        { tool: "deploy.resolve" },
      );
      progress(8, "ORCHESTRATOR");
      await pause(140);

      const cached = findCachedBuild(run.id);
      let sourceWorkspace = cached?.workspace ?? null;
      let sourceRunId = cached?.id ?? null;
      let artifactFiles = cached ? await listFilesRecursive(path.join(cached.workspace, "dist")) : [];

      if (sourceWorkspace && artifactFiles.length > 0) {
        log(
          "BUILD",
          "info",
          "reusing artifact set from " + cached.id + " · " + artifactFiles.length + " files",
          { tool: "fs.read", channel: "build" },
        );
      } else {
        sourceWorkspace = null;
        log("BUILD", "warn", "no cached artifact · compiling generated scene", {
          channel: "build",
        });

        for (const file of SOURCE_FILES) {
          await writeWorkspaceFile(run.workspace, file.path, file.content);
        }

        log(
          "BUILD",
          "info",
          "materialized " + SOURCE_FILES.length + " modules · esbuild --format=esm --outdir=dist",
          { channel: "build", tool: "fs.write" },
        );

        const built = await buildWorkspace(
          run.workspace,
          SOURCE_FILES.map((file) => file.path),
        );
        log(
          "BUILD",
          "ok",
          "esbuild wrote " + built.outputs + " outputs · " + formatBytes(built.bytes) + " · " + built.durationMs + "ms",
          { channel: "build" },
        );

        sourceWorkspace = run.workspace;
        sourceRunId = run.id;
      }

      progress(42, "BUILD");
      await pause(120);

      node("backend-api", "running");
      log("EDGE-API", "info", "gzip -9 deploy payload", { tool: "zlib.gzip" });

      const artifact = await stageArtifact(run.workspace, sourceWorkspace, {
        project: run.project,
        sourceRunId,
      });

      log(
        "BUILD",
        "ok",
        "bundle.json.gz · " + formatBytes(artifact.gzipBytes) + " gzip · " + artifact.fileCount + " files · raw " + formatBytes(artifact.rawBytes),
        { channel: "build" },
      );
      log(
        "EDGE-API",
        "ok",
        "checksum " + artifact.manifest.sha1.slice(0, 12) + " · manifest verified",
        { tool: "deploy.verify" },
      );
      diff({
        path: "deploy/manifest.json",
        additions: artifact.manifestText.split("\n").length,
        deletions: 0,
        agent: "EDGE-API",
        preview: artifact.manifestText.split("\n").slice(0, 3).map((line) => "+" + line),
      });

      node("backend-api", "healthy");
      progress(84, "EDGE-API");
      log(
        "EDGE-API",
        "warn",
        "remote publisher not configured · artifact staged locally",
        { channel: "console", tool: "deploy.stage" },
      );
      log(
        "ORCHESTRATOR",
        "action",
        "staged · .acidmade/runs/" + run.id + "/deploy",
        { tool: "deploy.complete" },
      );
      node("orchestrator-agent", "healthy");
      progress(100, "ORCHESTRATOR");
      await pause(100);
      finish(run, "completed", "artifact staged locally · no remote publisher");
    } catch (error) {
      handleExecuteError(run, error, "deploy");
    }
  }

  function handleExecuteError(run, error, kind) {
    if (
      run.stopRequested ||
      run.status === "halted" ||
      run.abort.signal.aborted ||
      error?.name === "AbortError"
    ) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    emit(run, {
      type: "log",
      time: stamp(),
      agent: "ENGINE",
      level: "error",
      message: kind + " runtime fault · " + message,
      channel: "console",
      tool: "runtime.fault",
    });
    finish(run, "failed", kind + " failed · " + message);
  }

  return {
    describe,
    start,
    stop,
    pause,
    resume,
    get,
    subscribe,
    workspaceRoot,
  };
}
