import http from "node:http";
import { createRuntime } from "./runtime/agent.mjs";
import { chatWithProvider } from "./ai/chat.mjs";

const PORT = Number(process.env.ACIDMADE_RUNTIME_PORT ?? 4317);
const HOST = process.env.ACIDMADE_RUNTIME_HOST ?? "127.0.0.1";
const MAX_BODY = 8 * 1024;
const MAX_AI_BODY = 12 * 1024 * 1024;

const runtime = createRuntime({ rootDir: process.cwd() });

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}

function readJson(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error("request body too large");
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        const error = new Error("invalid json body");
        error.status = 400;
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function streamRun(req, res, run) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
    "x-content-type-options": "nosniff",
  });
  res.write("retry: 1200\n\n");

  const writeEvent = (event) => {
    if (res.writableEnded) return;
    res.write("id: " + event.seq + "\n");
    res.write("data: " + JSON.stringify(event) + "\n\n");
  };

  const lastId = Number(req.headers["last-event-id"] ?? 0);
  if (Number.isFinite(lastId) && lastId > 0) {
    for (const event of run.events) {
      if (event.seq > lastId) writeEvent(event);
    }
  } else {
    for (const event of run.events) writeEvent(event);
  }

  const unsubscribe = runtime.subscribe(run.id, writeEvent);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": keep-alive " + Date.now() + "\n\n");
  }, 15000);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearInterval(sweep);
    unsubscribe?.();
    if (!res.writableEnded) res.end();
  };

  const sweep = setInterval(() => {
    if (run.finishedAt && Date.now() - run.finishedAt.getTime() > 60000) {
      cleanup();
    }
  }, 5000);

  req.on("close", cleanup);
  res.on("error", cleanup);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://" + (req.headers.host ?? "localhost"));
  const method = req.method ?? "GET";

  try {
    if (method === "OPTIONS") {
      res.writeHead(204, {
        allow: "GET, POST, OPTIONS",
        "cache-control": "no-store",
      });
      res.end();
      return;
    }

    if (url.pathname === "/api/runtime" && method === "GET") {
      json(res, 200, runtime.describe());
      return;
    }

    if (url.pathname === "/api/ai/chat" && method === "POST") {
      const body = await readJson(req, MAX_AI_BODY);
      const result = await chatWithProvider(body);
      json(res, 200, result);
      return;
    }

    if (url.pathname === "/api/runs" && method === "POST") {
      const body = await readJson(req);

      if (body.kind && body.kind !== "build" && body.kind !== "deploy") {
        json(res, 422, { error: "invalid_kind", message: "kind must be build or deploy" });
        return;
      }

      try {
        const run = runtime.start({
          kind: body.kind === "deploy" ? "deploy" : "build",
          intent: typeof body.intent === "string" ? body.intent : "",
          project: typeof body.project === "string" ? body.project : "northwind-analytics",
        });
        json(res, 202, {
          runId: run.id,
          run: {
            id: run.id,
            kind: run.kind,
            status: run.status,
            startedAt: run.startedAt,
          },
        });
      } catch (error) {
        if (error.code === "RUN_ACTIVE") {
          json(res, 409, {
            error: "run_active",
            message: error.message,
            activeRunId: error.runId,
          });
          return;
        }
        throw error;
      }
      return;
    }

    const eventsMatch = /^\/api\/runs\/([A-Za-z0-9_-]+)\/events$/.exec(url.pathname);
    if (eventsMatch && method === "GET") {
      const run = runtime.get(eventsMatch[1]);
      if (!run) {
        json(res, 404, { error: "run_not_found" });
        return;
      }
      streamRun(req, res, run);
      return;
    }

    const pauseMatch = /^\/api\/runs\/([A-Za-z0-9_-]+)\/(pause|resume)$/.exec(url.pathname);
    if (pauseMatch && method === "POST") {
      const run = runtime.get(pauseMatch[1]);
      if (!run) {
        json(res, 404, { error: "run_not_found" });
        return;
      }
      const updated =
        pauseMatch[2] === "pause"
          ? runtime.pause(pauseMatch[1])
          : runtime.resume(pauseMatch[1]);
      if (!updated) {
        json(res, 409, {
          error: "run_not_running",
          message: "run is not currently executing",
        });
        return;
      }
      json(res, 202, {
        runId: updated.id,
        paused: updated.paused,
        status: updated.status,
      });
      return;
    }

    const stopMatch = /^\/api\/runs\/([A-Za-z0-9_-]+)\/stop$/.exec(url.pathname);
    if (stopMatch && method === "POST") {
      const run = runtime.get(stopMatch[1]);
      if (!run) {
        json(res, 404, { error: "run_not_found" });
        return;
      }
      const stopped = runtime.stop(stopMatch[1]);
      json(res, 202, {
        stopped,
        runId: run.id,
        status: run.status,
      });
      return;
    }

    const snapshotMatch = /^\/api\/runs\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
    if (snapshotMatch && method === "GET") {
      const run = runtime.get(snapshotMatch[1]);
      if (!run) {
        json(res, 404, { error: "run_not_found" });
        return;
      }
      json(res, 200, {
        id: run.id,
        kind: run.kind,
        status: run.status,
        project: run.project,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        eventCount: run.events.length,
      });
      return;
    }

    json(res, 404, { error: "not_found" });
  } catch (error) {
    if (res.writableEnded) return;
    const status = error?.status ?? 500;
    json(res, status, {
      error: status === 500 ? "runtime_error" : "bad_request",
      message: error instanceof Error ? error.message : "unexpected runtime error",
    });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      "[runtime] port " + PORT + " is already in use · set ACIDMADE_RUNTIME_PORT to change it",
    );
  } else {
    console.error("[runtime] server error", error);
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    "[runtime] AcidMade local agent runtime listening on http://" + HOST + ":" + PORT,
  );
  console.log(
    "[runtime] tools: filesystem · esbuild · tsc · gzip · planner=local-reference",
  );
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
