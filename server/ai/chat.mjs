const DEFAULT_TIMEOUT = 90_000;
const MAX_MESSAGES = 30;
const MAX_TEXT = 24_000;
const MAX_IMAGES = 4;

function systemPrompt(context) {
  return [
    "You are Acid AI, the embedded agent copilot inside AcidMade, an AI-native application engine.",
    "AcidMade uses a Node, Scene and Signal architecture. Speak like an engine operator: precise, compact and technical.",
    "You can inspect the editor context below, but you cannot execute engine tools in this chat. Never claim to have run commands or changed files.",
    "You may propose exactly one scene change at a time. The operator must confirm it in the editor before anything is applied. Never say a change was applied.",
    "When proposing scene changes, prefer concrete node classes, signal names and res:// resource paths.",
    "",
    "RESPONSE FORMAT — return exactly one JSON object with no markdown fences and no prose outside it:",
    '{"reply":"<compact operator-facing reply>","action":null}',
    "When the operator explicitly asks to create, rename or configure a scene node, replace action with one of these exact shapes:",
    '{"type":"create","parentId":"<existing node id>","name":"<new node name>","className":"<available class>","kind":"ui|api|data|agent"}',
    '{"type":"rename","nodeId":"<existing node id>","name":"<new name>"}',
    '{"type":"configure","nodeId":"<existing node id>","changes":{"<property>":"<string|number|boolean>"}}',
    "Use only node ids from the scene tree and only classes from Available classes. Configure with one or more allowed keys for that node kind and valid primitive values.",
    "Do not invent node ids, class names or properties. One action per response. For a proposed change, say it is staged and needs confirmation in the reply.",
    "If the target is missing, duplicated or ambiguous, return action null and ask one short clarifying question.",
    "If the request is ordinary conversation, return action null. Keep reply concise and useful.",
    "",
    "Editor context:",
    context || "No active scene context was supplied.",
  ].join("\n");
}

const ACTION_TYPES = new Set(["create", "rename", "configure"]);
const ACTION_KINDS = new Set(["ui", "component", "api", "data", "agent"]);

function cleanActionString(value, max = 240) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanActionId(value) {
  const id = cleanActionString(value, 96);
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id) ? id : "";
}

function cleanChanges(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const changes = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = cleanActionString(rawKey, 48);
    if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)?$/.test(key)) continue;
    if (typeof rawValue === "string") changes[key] = rawValue.slice(0, 4000);
    else if (typeof rawValue === "number" && Number.isFinite(rawValue)) changes[key] = rawValue;
    else if (typeof rawValue === "boolean") changes[key] = rawValue;
    if (Object.keys(changes).length >= 12) break;
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

function sanitizeAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = cleanActionString(value.type, 20).toLowerCase();
  if (!ACTION_TYPES.has(type)) return null;
  if (type === "create") {
    const name = cleanActionString(value.name, 48);
    const className = cleanActionString(value.className, 64);
    const kind = cleanActionString(value.kind, 20).toLowerCase();
    if (!name || (!className && !ACTION_KINDS.has(kind))) return null;
    return {
      type,
      parentId: cleanActionId(value.parentId) || undefined,
      name,
      className: className || undefined,
      kind: ACTION_KINDS.has(kind) ? kind : undefined,
    };
  }
  if (type === "rename") {
    const nodeId = cleanActionId(value.nodeId);
    const name = cleanActionString(value.name, 48);
    return nodeId && name ? { type, nodeId, name } : null;
  }
  const nodeId = cleanActionId(value.nodeId);
  const changes = cleanChanges(value.changes);
  return nodeId && changes ? { type, nodeId, changes } : null;
}

function parseAssistantReply(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { message: "", action: null };
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1).trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const reply =
        (typeof parsed.reply === "string" ? parsed.reply.trim().slice(0, 6000) : "") ||
        (typeof parsed.message === "string" ? parsed.message.trim().slice(0, 6000) : "");
      const action = sanitizeAction(parsed.action);
      if (!reply && !action) continue;
      return {
        message: reply || "I can stage that scene change. Confirm it in the editor to apply it.",
        action,
      };
    } catch {
      // Providers occasionally ignore JSON-only mode; fall through to plain text.
    }
  }
  return { message: text, action: null };
}


function cleanBaseUrl(value, provider) {
  if (typeof value !== "string" || !value.trim()) {
    const fallback =
      provider === "anthropic"
        ? "https://api.anthropic.com"
        : provider === "ollama"
          ? "http://127.0.0.1:11434"
          : "https://api.openai.com/v1";
    return fallback;
  }
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("provider base URL must use http or https");
  }
  return value.trim().replace(/\/+$/, "");
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("at least one chat message is required");
  }
  return messages.slice(-MAX_MESSAGES).map((message) => {
    const role = message?.role === "assistant" ? "assistant" : "user";
    const content = typeof message?.content === "string" ? message.content.slice(0, MAX_TEXT) : "";
    if (!content.trim()) throw new Error("chat messages cannot be empty");
    return { role, content };
  });
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((image) => typeof image === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image))
    .slice(0, MAX_IMAGES);
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function textFromParts(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (part?.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

async function postJson(url, init, signal) {
  const response = await fetch(url, {
    ...init,
    signal,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const detail =
      (payload && (payload.error?.message || payload.error || payload.message)) ||
      text.slice(0, 240) ||
      response.statusText;
    const error = new Error("provider responded with " + response.status + " · " + detail);
    error.status = response.status;
    throw error;
  }
  if (!payload) throw new Error("provider returned an invalid JSON response");
  return payload;
}

function openAiEndpoint(baseUrl) {
  if (/\/chat\/completions$/.test(baseUrl)) return baseUrl;
  return baseUrl + "/chat/completions";
}

function anthropicEndpoint(baseUrl) {
  if (/\/messages$/.test(baseUrl)) return baseUrl;
  if (/\/v1$/.test(baseUrl)) return baseUrl + "/messages";
  return baseUrl + "/v1/messages";
}

function ollamaEndpoint(baseUrl) {
  if (/\/api\/chat$/.test(baseUrl)) return baseUrl;
  return baseUrl + "/api/chat";
}

async function callOpenAiCompatible({ baseUrl, apiKey, model, messages, images, context, signal }) {
  const apiMessages = [
    { role: "system", content: systemPrompt(context) },
    ...messages,
  ];
  if (images.length > 0) {
    const last = apiMessages[apiMessages.length - 1];
    if (last.role === "user") {
      last.content = [
        { type: "text", text: last.content },
        ...images.map((image) => ({ type: "image_url", image_url: { url: image } })),
      ];
    }
  }

  const payload = await postJson(
    openAiEndpoint(baseUrl),
    {
      method: "POST",
      headers: apiKey ? { authorization: "Bearer " + apiKey } : {},
      body: JSON.stringify({
        model,
        messages: apiMessages,
        max_tokens: 1600,
        temperature: 0.4,
      }),
    },
    signal,
  );

  const content = textFromParts(payload.choices?.[0]?.message?.content).trim();
  if (!content) throw new Error("provider returned an empty message");
  return {
    message: content,
    model: payload.model ?? model,
    usage: payload.usage ?? null,
  };
}

async function callAnthropic({ baseUrl, apiKey, model, messages, images, context, signal }) {
  const apiMessages = messages.map((message) => ({ ...message }));
  if (images.length > 0) {
    const last = apiMessages[apiMessages.length - 1];
    if (last.role === "user") {
      last.content = [
        { type: "text", text: last.content },
        ...images
          .map(parseDataUrl)
          .filter(Boolean)
          .map((image) => ({
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType,
              data: image.data,
            },
          })),
      ];
    }
  }

  const payload = await postJson(
    anthropicEndpoint(baseUrl),
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt(context),
        messages: apiMessages,
        max_tokens: 1600,
        temperature: 0.4,
      }),
    },
    signal,
  );

  const content = Array.isArray(payload.content)
    ? payload.content
        .filter((block) => block?.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim()
    : "";
  if (!content) throw new Error("provider returned an empty message");
  return {
    message: content,
    model: payload.model ?? model,
    usage: payload.usage ?? null,
  };
}

async function callOllama({ baseUrl, model, messages, images, context, signal }) {
  const apiMessages = [
    { role: "system", content: systemPrompt(context) },
    ...messages.map((message) => ({ ...message })),
  ];
  if (images.length > 0) {
    const last = apiMessages[apiMessages.length - 1];
    if (last.role === "user") {
      last.images = images
        .map(parseDataUrl)
        .filter(Boolean)
        .map((image) => image.data);
    }
  }

  const payload = await postJson(
    ollamaEndpoint(baseUrl),
    {
      method: "POST",
      body: JSON.stringify({
        model,
        messages: apiMessages,
        stream: false,
        options: { temperature: 0.4 },
      }),
    },
    signal,
  );

  const content = (payload.message?.content ?? "").trim();
  if (!content) throw new Error("Ollama returned an empty message");
  return {
    message: content,
    model: payload.model ?? model,
    usage: payload.eval_count
      ? { output_tokens: payload.eval_count, input_tokens: payload.prompt_eval_count }
      : null,
  };
}

export async function chatWithProvider(input) {
  const provider = input?.provider;
  try {
    if (provider !== "openai" && provider !== "anthropic" && provider !== "ollama") {
      throw new Error("provider must be openai-compatible, anthropic or ollama");
    }
    if (!Array.isArray(input?.messages) || input.messages.length === 0) {
      throw new Error("at least one chat message is required");
    }
    if (provider !== "ollama" && !(typeof input?.apiKey === "string" && input.apiKey.trim())) {
      throw new Error("an API key is required for this provider");
    }
    if (typeof input?.model !== "string" || !input.model.trim()) {
      throw new Error("a model name is required");
    }
  } catch (error) {
    error.status = 400;
    throw error;
  }
  const baseUrl = cleanBaseUrl(input?.baseUrl, provider);
  const model = input.model.trim().slice(0, 120);
  const apiKey = typeof input?.apiKey === "string" ? input.apiKey.trim() : "";
  const messages = normalizeMessages(input?.messages);
  const images = normalizeImages(input?.images);
  const context = typeof input?.context === "string" ? input.context.slice(0, 8000) : "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const args = {
      baseUrl,
      apiKey,
      model,
      messages,
      images,
      context,
      signal: controller.signal,
    };
    const result =
      provider === "anthropic"
        ? await callAnthropic(args)
        : provider === "ollama"
          ? await callOllama(args)
          : await callOpenAiCompatible(args);
    const parsed = parseAssistantReply(result.message);

    return {
      provider,
      ...result,
      message: parsed.message,
      action: parsed.action,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("provider request timed out after 90s");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
