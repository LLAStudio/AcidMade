import type { DiffFile, LogLevel, NodeStatus, Problem } from "../types";
import { apiUrl } from "./api";

export interface RuntimeInfo {
  online: boolean;
  service: string;
  version: string;
  planner: string;
  mode: string;
  tools: string[];
  workspace: string;
  activeRunId: string | null;
  capabilities: string[];
}

export interface RuntimeEventBase {
  seq: number;
  runId: string;
  at: number;
}

export type RuntimeEvent =
  | (RuntimeEventBase & {
      type: "started";
      kind: "build" | "deploy";
      project: string;
      intent: string;
    })
  | (RuntimeEventBase & {
      type: "log";
      time: string;
      agent: string;
      level: LogLevel;
      message: string;
      channel?: "console" | "build";
      nodeId?: string;
      tool?: string;
    })
  | (RuntimeEventBase & { type: "node"; nodeId: string; status: NodeStatus })
  | (RuntimeEventBase & { type: "progress"; value: number; agent?: string })
  | (RuntimeEventBase & { type: "problem"; problem: Problem })
  | (RuntimeEventBase & { type: "healed"; problemId: string })
  | (RuntimeEventBase & { type: "diff"; diff: DiffFile })
  | (RuntimeEventBase & {
      type: "status";
      status: "completed" | "failed" | "halted";
      message: string;
    });

export interface StartRunResponse {
  runId: string;
}

export class RuntimeRequestError extends Error {
  code?: string;
  status?: number;
  activeRunId?: string;
}

function endpoint(path: string): string {
  return apiUrl("/api" + path);
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "runtime request timed out";
    return error.message;
  }
  return "runtime request failed";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(endpoint(path), {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const record = payload as
        | { message?: string; error?: string; activeRunId?: string }
        | null;
      const error = new RuntimeRequestError(
        record?.message ??
          record?.error ??
          "runtime responded with HTTP " + response.status,
      );
      error.code = record?.error;
      error.status = response.status;
      error.activeRunId = record?.activeRunId;
      throw error;
    }

    return payload as T;
  } catch (error) {
    if (error instanceof RuntimeRequestError) throw error;
    throw new Error(describeError(error));
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  return request<RuntimeInfo>("/runtime");
}

export async function startRuntimeRun(input: {
  kind: "build" | "deploy";
  project?: string;
  intent?: string;
}): Promise<StartRunResponse> {
  return request<StartRunResponse>("/runs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function stopRuntimeRun(runId: string): Promise<void> {
  await request<unknown>("/runs/" + encodeURIComponent(runId) + "/stop", {
    method: "POST",
    body: "{}",
  });
}

export async function pauseRuntimeRun(runId: string): Promise<void> {
  await request<unknown>("/runs/" + encodeURIComponent(runId) + "/pause", {
    method: "POST",
    body: "{}",
  });
}

export async function resumeRuntimeRun(runId: string): Promise<void> {
  await request<unknown>("/runs/" + encodeURIComponent(runId) + "/resume", {
    method: "POST",
    body: "{}",
  });
}

export function connectRunStream(
  runId: string,
  handlers: {
    onEvent: (event: RuntimeEvent) => void;
    onOpen?: () => void;
    onError?: (source: EventSource) => void;
    onInvalid?: (payload: string) => void;
  },
): EventSource {
  const source = new EventSource(endpoint("/runs/" + encodeURIComponent(runId) + "/events"));

  source.onopen = () => handlers.onOpen?.();
  source.onmessage = (message) => {
    try {
      handlers.onEvent(JSON.parse(message.data) as RuntimeEvent);
    } catch {
      handlers.onInvalid?.(message.data);
    }
  };
  source.onerror = () => handlers.onError?.(source);

  return source;
}
