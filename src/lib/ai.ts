import type { NodeKind } from "../types";
import { apiUrl } from "./api";

export type AiProviderId = "openai" | "anthropic" | "ollama";

export interface AiProviderMeta {
  id: AiProviderId;
  label: string;
  short: string;
  baseUrl: string;
  model: string;
  keyRequired: boolean;
  hint: string;
  models: string[];
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: "openai",
    label: "OpenAI / compatible",
    short: "OPENAI-COMPATIBLE",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    keyRequired: true,
    hint: "OpenAI, Gemini compatibility, Baseten or any /chat/completions endpoint.",
    models: ["gpt-4.1-mini", "gpt-4.1", "gemini-2.5-pro", "claude-sonnet-4-6"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    short: "ANTHROPIC",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-6",
    keyRequired: true,
    hint: "Native Messages API with vision support.",
    models: ["claude-sonnet-4-6", "claude-opus-4-1", "claude-haiku-4-5"],
  },
  {
    id: "ollama",
    label: "Ollama",
    short: "OLLAMA · LOCAL",
    baseUrl: "http://127.0.0.1:11434",
    model: "llama3.3",
    keyRequired: false,
    hint: "Local Ollama runtime. No API key leaves your machine.",
    models: ["llama3.3", "qwen2.5-coder", "deepseek-r1", "llava"],
  },
];

export interface AiSettings {
  provider: AiProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AiChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiNodeAction {
  type: "create" | "rename" | "configure";
  parentId?: string;
  nodeId?: string;
  name?: string;
  className?: string;
  kind?: NodeKind;
  changes?: Record<string, string | number | boolean>;
}

export interface AiChatResponse {
  provider: AiProviderId;
  message: string;
  model: string;
  usage: unknown;
  action?: AiNodeAction | null;
}

export function providerMeta(provider: AiProviderId): AiProviderMeta {
  return AI_PROVIDERS.find((item) => item.id === provider) ?? AI_PROVIDERS[0];
}

export async function askAcidAi(
  settings: AiSettings,
  messages: AiChatRequestMessage[],
  context: string,
  images: string[],
): Promise<AiChatResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 100000);

  try {
    const response = await fetch(apiUrl("/api/ai/chat"), {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: settings.apiKey,
        messages,
        images,
        context,
      }),
    });

    const text = await response.text();
    let payload: {
      message?: string;
      error?: string;
      detail?: string;
      provider?: AiProviderId;
      model?: string;
      usage?: unknown;
      action?: AiNodeAction | null;
    } | null = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      throw new Error(
        payload?.message ??
          payload?.error ??
          (response.status === 413
            ? "attachments are too large · keep images under 2 MB each"
            : "AI provider request failed with HTTP " + response.status),
      );
    }

    if (!payload?.message) throw new Error("AI provider returned an empty response");
    return {
      provider: payload.provider ?? settings.provider,
      message: payload.message,
      model: payload.model ?? settings.model,
      usage: payload.usage ?? null,
      action: payload.action ?? null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("AI request timed out · provider did not respond");
    }
    if (error instanceof Error) throw error;
    throw new Error("AI provider request failed");
  } finally {
    window.clearTimeout(timeout);
  }
}
