import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { NODE_CATALOG } from "../data/nodeCatalog";
import { defaultProps } from "../data/nodeProps";
import { findSceneNode, flattenScene, scenePath } from "../data/scene";
import { resourceById } from "../data/resources";
import { LANGUAGES, loadLanguageSelection } from "../lib/languages";
import {
  AI_PROVIDERS,
  askAcidAi,
  providerMeta,
  type AiNodeAction,
  type AiProviderId,
  type AiSettings,
} from "../lib/ai";
import { stageNodeAction, type NodeActionProposal } from "../lib/nodeActions";
import { cx } from "../lib/utils";

interface Attachment {
  id: string;
  name: string;
  kind: "image" | "text";
  mime: string;
  size: number;
  dataUrl?: string;
  text?: string;
}

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  display?: string;
  images?: { name: string; dataUrl: string }[];
  files?: string[];
  error?: boolean;
}

interface StagedChange {
  action: AiNodeAction;
  proposal: NodeActionProposal;
}

const STORAGE_KEY = "acidmade.ai.config";

function defaults(provider: AiProviderId, key = ""): AiSettings {
  const meta = providerMeta(provider);
  return { provider, baseUrl: meta.baseUrl, model: meta.model, apiKey: key };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("could not read " + file.name));
    reader.readAsDataURL(file);
  });
}

function id(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

export function AiPanel() {
  const {
    aiOpen,
    setAiOpen,
    tree,
    selectedNodeId,
    activeFileId,
    project,
    problems,
    runtime,
    logs,
    overrides,
    pushLog,
    addNode,
    renameNode,
    configureNode,
    setRightTab,
  } = useEngine();

  const [settings, setSettings] = useState<AiSettings>(() => defaults("openai"));
  const [connected, setConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<StagedChange | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const meta = providerMeta(settings.provider);
  const node = findSceneNode(tree, selectedNodeId);
  const activeFile = resourceById(activeFileId);
  const openProblems = problems.filter((problem) => !problem.healed);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { provider?: AiProviderId; baseUrl?: string; model?: string };
      if (!parsed.provider || !AI_PROVIDERS.some((item) => item.id === parsed.provider)) return;
      setSettings({
        provider: parsed.provider,
        baseUrl: parsed.baseUrl || providerMeta(parsed.provider).baseUrl,
        model: parsed.model || providerMeta(parsed.provider).model,
        apiKey: "",
      });
    } catch {
      // Non-secret config is optional; ignore malformed storage.
    }
  }, []);

  useEffect(() => {
    if (!aiOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAiOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [aiOpen, setAiOpen]);

  useEffect(() => {
    const nodeRef = scrollRef.current;
    if (nodeRef) nodeRef.scrollTop = nodeRef.scrollHeight;
  }, [messages.length, pendingChange, sending, showSettings, connected, aiOpen]);

  const context = useMemo(() => {
    const diagnostics = openProblems
      .map((problem) => problem.code + " " + problem.file + ":" + problem.line + " " + problem.message)
      .slice(0, 5)
      .join("; ");
    const sceneLines = flattenScene(tree)
      .slice(0, 80)
      .map((item) => {
        const trail = scenePath(tree, item.id);
        const parent = trail[trail.length - 2];
        return (
          "- " +
          item.id +
          " | " +
          item.name +
          " | " +
          item.className +
          " | " +
          item.kind +
          " | parent: " +
          (parent?.id ?? "none")
        );
      });
    const classes = NODE_CATALOG.flatMap((group) => group.classes)
      .map((item) => item.className + " (" + item.kind + ")")
      .join(", ");
    const effectiveConfig = node
      ? { ...defaultProps(node), ...(overrides[node.id] ?? {}) }
      : null;
    const configLine = effectiveConfig
      ? Object.entries(effectiveConfig)
          .filter(([key]) => key !== "systemPrompt")
          .map(([key, value]) => key + "=" + String(value).slice(0, 48))
          .join(", ")
      : "none";
    return [
      "Project: " + project.name + " (" + project.slug + "), branch " + project.branch,
      "Selected node: " +
        (node
          ? node.name + " <" + node.className + "> · id " + node.id + " · kind " + node.kind
          : "none"),
      "Active resource: res://" + (activeFile?.path ?? "scenes/MainApp.acid"),
      "Open diagnostics: " + (diagnostics || "none"),
      "Runtime: " + runtime.status + " · " + (runtime.info?.mode ?? "reference") + " · planner " + (runtime.info?.planner ?? "local-reference"),
      "Recent engine lines: " +
        logs
          .slice(-5)
          .map((entry) => "[" + entry.agent + "] " + entry.message)
          .join(" · "),
      "",
      "Active scene tree (id | name | class | kind | parent):",
      ...sceneLines,
      "",
      "Available classes: " + classes,
      "Editable keys by kind:",
      "ui: process, x, y, layoutMode, flexDirection, gap, padding, width, height, grow, tailwind",
      "api: process, method, timeout, retries, cache, rateLimit",
      "data: process, engine, region, schema, pool",
      "agent: process, model, autonomy, maxSteps, memoryScope, temperature, canReadFiles, canExecTerminal, canSelfHeal, canDeployProd, systemPrompt",
      "Selected node config: " + configLine,
      "Scene changes are staged by the editor and must be confirmed by the operator before they are applied.",
    ].join("\n");
  }, [
    activeFile?.path,
    logs,
    node,
    openProblems,
    overrides,
    project.branch,
    project.name,
    project.slug,
    runtime.info?.mode,
    runtime.info?.planner,
    runtime.status,
    tree,
  ]);

  if (!aiOpen) return null;

  const changeProvider = (provider: AiProviderId) => {
    if (provider === settings.provider) return;
    const next = defaults(provider);
    setSettings(next);
    setConnected(false);
    setShowSettings(true);
    setFormError(null);
    setShowKey(false);
  };

  const connect = () => {
    setFormError(null);
    if (!/^https?:\/\//.test(settings.baseUrl.trim())) {
      setFormError("Base URL must start with http:// or https://");
      return;
    }
    if (!settings.model.trim()) {
      setFormError("A model name is required.");
      return;
    }
    if (meta.keyRequired && !settings.apiKey.trim()) {
      setFormError("Paste an API key for " + meta.label + ".");
      return;
    }
    setConnected(true);
    setShowSettings(false);
    setShowKey(false);
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          provider: settings.provider,
          baseUrl: settings.baseUrl.trim(),
          model: settings.model.trim(),
        }),
      );
    } catch {
      // Storage can be unavailable; the session still works.
    }
    pushLog(
      "AcidAI",
      "ok",
      "agent provider connected · " +
        meta.short.toLowerCase() +
        " · " +
        settings.model.trim() +
        " · key held in memory",
    );
    if (messages.length === 0) {
      setMessages([
        {
          id: id("msg"),
          role: "assistant",
          content:
            "Provider connected: " +
            meta.label +
            " · " +
            settings.model.trim() +
            ".\n\nI can see " +
            (node ? node.name + " <" + node.className + ">" : "the active scene") +
            " and " +
            (activeFile ? "res://" + activeFile.path : "the MainApp scene") +
            ".\nAsk me to inspect a node, draft an agent prompt, wire a signal, or explain a diagnostic.\n\nScene changes: ask me to create, rename or configure a node. I will stage the change with a diff and wait for your confirmation before applying it. Try “Create a KPI data widget under DashboardPage”, “Rename MetricsGrid to KPI Grid”, or “Set DataAnalystAgent maxSteps to 40”.",
        },
      ]);
    }
  };

  const disconnect = () => {
    setConnected(false);
    setSettings((current) => ({ ...current, apiKey: "" }));
    setFormError(null);
    pushLog("AcidAI", "info", "agent provider disconnected · key cleared from memory");
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachError(null);
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (attachments.length + next.length >= 4) {
        setAttachError("Up to 4 attachments per message.");
        break;
      }
      const image = file.type.startsWith("image/");
      const textLike =
        file.type.startsWith("text/") ||
        /\.(txt|md|ts|tsx|js|jsx|json|css|html|py|yml|yaml|toml|sh)$/i.test(file.name);
      try {
        if (image) {
          if (file.size > 2 * 1024 * 1024) {
            setAttachError(file.name + " is larger than 2 MB.");
            continue;
          }
          const dataUrl = await readAsDataUrl(file);
          next.push({ id: id("att"), name: file.name, kind: "image", mime: file.type, size: file.size, dataUrl });
        } else if (textLike) {
          if (file.size > 512 * 1024) {
            setAttachError(file.name + " is larger than 512 KB.");
            continue;
          }
          const text = await file.text();
          next.push({
            id: id("att"),
            name: file.name,
            kind: "text",
            mime: file.type || "text/plain",
            size: file.size,
            text: text.slice(0, 20000),
          });
        } else {
          setAttachError(file.name + " is not a supported text or image file.");
        }
      } catch (error) {
        setAttachError(error instanceof Error ? error.message : "could not read attachment");
      }
    }
    setAttachments((current) => [...current, ...next].slice(0, 4));
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async () => {
    if (sending) return;
    if (pendingChange) {
      setChatError("Confirm or discard the staged scene change before sending another message.");
      return;
    }
    if (!connected) {
      setShowSettings(true);
      setFormError("Connect an agent provider before sending a message.");
      return;
    }
    if (!draft.trim() && attachments.length === 0) return;

    const imageAttachments = attachments.filter((item) => item.kind === "image" && item.dataUrl);
    const textAttachments = attachments.filter((item) => item.kind === "text" && item.text);
    let apiContent = draft.trim();
    if (textAttachments.length > 0) {
      apiContent +=
        "\n\nAttached files:\n" +
        textAttachments
          .map((item) => "--- " + item.name + " ---\n" + (item.text ?? ""))
          .join("\n\n");
    }
    if (imageAttachments.length > 0) {
      apiContent +=
        "\n\nAttached images: " + imageAttachments.map((item) => item.name).join(", ");
    }

    const userMessage: UiMessage = {
      id: id("msg"),
      role: "user",
      content: apiContent,
      display: draft.trim() || "Attached " + attachments.length + " file(s)",
      images: imageAttachments.map((item) => ({ name: item.name, dataUrl: item.dataUrl as string })),
      files: attachments.map((item) => item.name),
    };
    const history = [
      ...messages
        .filter((message) => !message.error)
        .map((message) => ({ role: message.role, content: message.content })),
      { role: "user" as const, content: apiContent },
    ];

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setAttachments([]);
    setSending(true);
    setChatError(null);
    pushLog("AcidAI", "action", "chat request · " + meta.short.toLowerCase() + " · " + settings.model);

    try {
      const preferred = loadLanguageSelection() ?? [];
      const languageContext =
        "Preferred languages: " +
        (preferred.length > 0
          ? preferred
              .map((id) => LANGUAGES.find((language) => language.id === id)?.label ?? id)
              .join(", ")
          : "none selected") +
        ". Prefer these languages when proposing code or agent resources.";
      const response = await askAcidAi(
        { ...settings, baseUrl: settings.baseUrl.trim(), model: settings.model.trim() },
        history,
        context + "\n" + languageContext,
        imageAttachments.map((item) => item.dataUrl as string),
      );
      let content = response.message;
      if (response.action) {
        const staged = stageNodeAction(response.action, tree, selectedNodeId, overrides);
        if (staged.ok) {
          setPendingChange({ action: response.action, proposal: staged.proposal });
        } else {
          content += "\n\nScene change not staged · " + staged.error;
          setChatError("Scene change not staged · " + staged.error);
          pushLog("AcidAI", "warn", "scene action rejected · " + staged.error);
        }
      }
      setMessages((current) => [
        ...current,
        { id: id("msg"), role: "assistant", content },
      ]);
      pushLog(
        "AcidAI",
        "ok",
        "provider response · " + response.model + " · " + response.message.length + " chars",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed";
      setChatError(message);
      setMessages((current) => [
        ...current,
        {
          id: id("msg"),
          role: "assistant",
          content: "Provider error · " + message,
          error: true,
        },
      ]);
      pushLog("AcidAI", "error", "chat request failed · " + message);
    } finally {
      setSending(false);
    }
  };

  const discardPendingChange = () => {
    if (!pendingChange) return;
    const summary = pendingChange.proposal.summary;
    setPendingChange(null);
    setChatError(null);
    setMessages((current) => [
      ...current,
      {
        id: id("msg"),
        role: "assistant",
        content: "Discarded “" + summary + ".” The scene was not changed.",
      },
    ]);
    pushLog("AcidAI", "info", "staged change discarded · " + summary);
  };

  const applyPendingChange = () => {
    if (!pendingChange) return;
    const checked = stageNodeAction(pendingChange.action, tree, selectedNodeId, overrides);
    if (!checked.ok) {
      setPendingChange(null);
      setChatError("Scene change could not be applied · " + checked.error);
      setMessages((current) => [
        ...current,
        {
          id: id("msg"),
          role: "assistant",
          content: "Scene change could not be applied · " + checked.error,
          error: true,
        },
      ]);
      pushLog("AcidAI", "error", "staged change failed · " + checked.error);
      return;
    }

    const proposal = checked.proposal;
    let confirmation = "";

    if (proposal.type === "create") {
      if (
        !proposal.parentId ||
        !proposal.name ||
        !proposal.className ||
        !proposal.kind ||
        !proposal.icon
      ) {
        setChatError("The staged create action is incomplete.");
        return;
      }
      addNode({
        parentId: proposal.parentId,
        name: proposal.name,
        className: proposal.className,
        kind: proposal.kind,
        icon: proposal.icon,
        summary: proposal.nodeSummary ?? "AI-created " + proposal.className,
      });
      confirmation =
        "Applied — created " + proposal.name + " as a " + proposal.className + ". " +
        "It is selected in the scene and Inspector.";
    } else if (proposal.type === "rename") {
      if (!proposal.nodeId || !proposal.name) {
        setChatError("The staged rename action is incomplete.");
        return;
      }
      renameNode(proposal.nodeId, proposal.name);
      confirmation =
        "Applied — renamed the node to " + proposal.name + ". It is selected in Inspector.";
    } else {
      if (!proposal.nodeId || !proposal.config) {
        setChatError("The staged configure action is incomplete.");
        return;
      }
      configureNode(proposal.nodeId, proposal.config);
      confirmation =
        "Applied — " +
        proposal.summary +
        " · " +
        (proposal.changes?.length ?? 0) +
        " " +
        (proposal.changes?.length === 1 ? "property" : "properties") +
        " updated. The node is selected in Inspector.";
    }

    setPendingChange(null);
    setChatError(null);
    setRightTab("inspector");
    setMessages((current) => [
      ...current,
      { id: id("msg"), role: "assistant", content: confirmation },
    ]);
    pushLog("AcidAI", "ok", "operator confirmed · " + proposal.summary);
  };

  const suggestions = [
    "Create a KPI data widget under DashboardPage.",
    "Rename MetricsGrid to KPI Grid.",
    "Set DataAnalystAgent maxSteps to 40.",
    "Explain the selected node and its signals.",
  ];
  const StageIcon =
    pendingChange?.proposal.type === "create"
      ? Plus
      : pendingChange?.proposal.type === "rename"
        ? Pencil
        : SlidersHorizontal;

  const showProviderCard = !connected || showSettings;

  return (
    <div className="fixed bottom-[30px] right-3 z-[68] flex h-[548px] max-h-[calc(100vh-52px)] w-[392px] max-w-[calc(100vw-24px)] flex-col overflow-hidden border border-line bg-panel shadow-[0_24px_70px_rgba(0,0,0,0.7)]">
      <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-line bg-shell px-2">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[2px] bg-acid shadow-[0_0_14px_rgba(204,255,0,0.15)]">
          <Sparkles size={12} className="text-[#0a0c04]" />
        </span>
        <div className="min-w-0 leading-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-zinc-100">Acid AI</span>
            <span className="border border-acid/20 bg-acid/[0.04] px-1 font-mono text-[6.5px] uppercase tracking-[0.08em] text-acid/55">
              agent
            </span>
          </div>
          <div className="mt-[2px] flex items-center gap-1 font-mono text-[7.5px] text-zinc-600">
            <span className={cx("h-[3px] w-[3px] rounded-full", connected ? "bg-acid" : "bg-zinc-700")} />
            <span className="truncate">
              {connected ? meta.short + " · " + settings.model : "provider not connected"}
            </span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSettings((value) => !value)}
            aria-label="Agent provider settings"
            title="Agent provider settings"
            className={cx(
              "grid h-[21px] w-[21px] place-items-center border",
              showSettings
                ? "border-acid/30 bg-acid/[0.06] text-acid/80"
                : "border-transparent text-zinc-600 hover:border-line hover:bg-elevated hover:text-zinc-300",
            )}
          >
            <Settings2 size={10} />
          </button>
          <button
            type="button"
            onClick={() => setAiOpen(false)}
            aria-label="Close Acid AI"
            className="grid h-[21px] w-[21px] place-items-center border border-transparent text-zinc-600 hover:border-line hover:bg-elevated hover:text-zinc-300"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto select-text">
        {showProviderCard ? (
          <div className="border-b border-line bg-[#0a0c0e] p-2.5">
            <div className="flex items-center gap-1.5">
              <KeyRound size={9} className="text-acid/60" />
              <span className="label-caps text-[8px] text-zinc-500">Agent provider</span>
              {connected ? (
                <span className="ml-auto flex items-center gap-1 font-mono text-[7px] text-acid/60">
                  <Check size={8} />
                  connected
                </span>
              ) : (
                <span className="ml-auto font-mono text-[7px] text-zinc-700">BYOK · Ollama ready</span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1">
              {AI_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => changeProvider(provider.id)}
                  className={cx(
                    "flex h-[24px] items-center justify-center border text-[8.5px] transition-colors",
                    settings.provider === provider.id
                      ? "border-acid/35 bg-acid/[0.06] text-acid/85"
                      : "border-line bg-void text-zinc-500 hover:border-zinc-600 hover:text-zinc-300",
                  )}
                >
                  {provider.label}
                </button>
              ))}
            </div>

            {meta.keyRequired ? (
              <label className="mt-2 block">
                <span className="mb-1 block font-mono text-[7px] uppercase tracking-[0.08em] text-zinc-600">
                  API key
                </span>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={settings.apiKey}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, apiKey: event.target.value }))
                    }
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="paste provider key · held in memory"
                    className="engine-input h-[23px] pr-7 font-mono text-[9px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    className="absolute right-1 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center text-zinc-600 hover:text-zinc-300"
                  >
                    {showKey ? <EyeOff size={9} /> : <Eye size={9} />}
                  </button>
                </div>
              </label>
            ) : (
              <div className="mt-2 flex h-[23px] items-center gap-1.5 border border-line bg-void px-2 font-mono text-[8px] text-zinc-500">
                <span className="h-1 w-1 rounded-full bg-[#A3E635]/60" />
                local Ollama · no API key required
              </div>
            )}

            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <label className="block">
                <span className="mb-1 block font-mono text-[7px] uppercase tracking-[0.08em] text-zinc-600">
                  Base URL
                </span>
                <input
                  value={settings.baseUrl}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, baseUrl: event.target.value }))
                  }
                  spellCheck={false}
                  className="engine-input h-[23px] font-mono text-[8px]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[7px] uppercase tracking-[0.08em] text-zinc-600">
                  Model
                </span>
                <input
                  value={settings.model}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, model: event.target.value }))
                  }
                  list="acid-ai-models"
                  spellCheck={false}
                  className="engine-input h-[23px] font-mono text-[8px]"
                />
                <datalist id="acid-ai-models">
                  {meta.models.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </label>
            </div>

            <p className="mt-1.5 font-mono text-[7px] leading-relaxed text-zinc-700">
              {meta.hint}
            </p>

            {formError ? (
              <div className="mt-1.5 flex items-start gap-1 border border-danger/25 bg-danger/[0.05] px-1.5 py-1 font-mono text-[7.5px] text-danger/85">
                <AlertCircle size={8} className="mt-[1px] shrink-0" />
                {formError}
              </div>
            ) : null}

            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={connect}
                className="flex h-[24px] flex-1 items-center justify-center gap-1 border border-acid/40 bg-acid px-2 text-[9px] font-medium text-[#0b0d04] hover:bg-[#d7ff33]"
              >
                <Check size={9} />
                {connected ? "Apply provider" : "Connect provider"}
              </button>
              {connected ? (
                <button
                  type="button"
                  onClick={disconnect}
                  className="h-[24px] border border-line px-2 font-mono text-[8px] text-zinc-600 hover:border-danger/30 hover:text-danger/80"
                >
                  forget key
                </button>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-[6.5px] leading-relaxed text-zinc-700">
              Key is sent only to the local AcidMade runtime, which proxies the provider. It is not
              written to disk or localStorage.
            </p>
          </div>
        ) : null}

        {connected && messages.length === 0 ? (
          <div className="p-3">
            <div className="border border-line bg-void/60 p-2.5">
              <div className="flex items-center gap-1.5">
                <Bot size={11} className="text-acid" />
                <span className="text-[10px] font-medium text-zinc-200">Agent online.</span>
              </div>
              <p className="mt-1 text-[9.5px] leading-relaxed text-zinc-500">
                I have the active scene context. Ask about{" "}
                <span className="text-zinc-300">{node?.name ?? "MainApp"}</span>, signals, build
                diagnostics or the agent runtime.
              </p>
            </div>
            <div className="mt-2 space-y-1">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setDraft(suggestion)}
                  className="flex w-full items-center gap-1.5 border border-line bg-panel px-2 py-[5px] text-left text-[9px] text-zinc-500 hover:border-acid/25 hover:bg-acid/[0.025] hover:text-zinc-300"
                >
                  <Sparkles size={8} className="shrink-0 text-acid/50" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.length > 0 ? (
          <div className="space-y-2 p-2.5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cx("flex gap-1.5", message.role === "user" ? "justify-end" : "justify-start")}
              >
                {message.role === "assistant" ? (
                  <span
                    className={cx(
                      "mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center border",
                      message.error
                        ? "border-danger/25 bg-danger/[0.05]"
                        : "border-acid/25 bg-acid/[0.05]",
                    )}
                  >
                    {message.error ? (
                      <AlertCircle size={9} className="text-danger" />
                    ) : (
                      <Sparkles size={9} className="text-acid" />
                    )}
                  </span>
                ) : null}
                <div
                  className={cx(
                    "max-w-[86%] border px-2 py-1.5",
                    message.role === "user"
                      ? "border-acid/20 bg-acid/[0.04]"
                      : message.error
                        ? "border-danger/20 bg-danger/[0.035]"
                        : "border-line bg-void/50",
                  )}
                >
                  {message.images && message.images.length > 0 ? (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {message.images.map((image) => (
                        <img
                          key={image.name}
                          src={image.dataUrl}
                          alt={image.name}
                          className="h-12 w-12 border border-line object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                  <div
                    className={cx(
                      "whitespace-pre-wrap break-words text-[10px] leading-[1.6]",
                      message.error ? "text-danger/85" : "text-zinc-300",
                    )}
                  >
                    {message.display ?? message.content}
                  </div>
                  {message.files && message.files.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {message.files.map((file) => (
                        <span
                          key={file}
                          className="flex items-center gap-1 border border-line bg-void px-1 py-[1px] font-mono text-[6.5px] text-zinc-600"
                        >
                          <FileText size={7} />
                          {file}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-0.5 font-mono text-[6px] uppercase tracking-[0.08em] text-zinc-700">
                    {message.role === "user" ? "operator" : message.error ? "error" : "acid ai"}
                  </div>
                </div>
              </div>
            ))}
            {sending ? (
              <div className="flex gap-1.5">
                <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center border border-acid/25 bg-acid/[0.05]">
                  <Sparkles size={9} className="text-acid" />
                </span>
                <div className="flex items-center gap-1 border border-line bg-void/50 px-2 py-1.5">
                  <span className="h-[3px] w-[3px] animate-pulse rounded-full bg-acid" />
                  <span className="h-[3px] w-[3px] animate-pulse rounded-full bg-acid [animation-delay:120ms]" />
                  <span className="h-[3px] w-[3px] animate-pulse rounded-full bg-acid [animation-delay:240ms]" />
                  <span className="ml-1 font-mono text-[7px] text-zinc-600">
                    {meta.short.toLowerCase()} thinking
                  </span>
                </div>
              </div>
            ) : null}

            {pendingChange ? (
              <div className="overflow-hidden border border-acid/35 bg-[#0a0d05]">
                <div className="flex items-center gap-1.5 border-b border-acid/15 bg-acid/[0.04] px-2 py-1.5">
                  <ShieldCheck size={10} className="shrink-0 text-acid" />
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-acid/85">
                    Staged scene change
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[6.5px] text-acid/45">
                    confirm to apply
                  </span>
                </div>
                <div className="p-2">
                  <div className="flex items-start gap-1.5">
                    <span className="mt-[1px] grid h-[22px] w-[22px] shrink-0 place-items-center border border-acid/25 bg-acid/[0.06]">
                      <StageIcon size={11} className="text-acid" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium leading-tight text-zinc-100">
                        {pendingChange.proposal.summary}
                      </div>
                      <p className="mt-[3px] text-[9px] leading-snug text-zinc-500">
                        {pendingChange.proposal.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 border-t border-line-soft">
                    {pendingChange.proposal.facts.map((fact) => (
                      <div
                        key={fact.label}
                        className="flex items-start justify-between gap-3 border-b border-line-soft/60 py-[3px] font-mono text-[7.5px]"
                      >
                        <span className="shrink-0 text-zinc-600">{fact.label}</span>
                        <span
                          className="min-w-0 truncate text-right text-zinc-400"
                          title={fact.value}
                        >
                          {fact.value}
                        </span>
                      </div>
                    ))}
                    {pendingChange.proposal.changes?.map((change) => (
                      <div
                        key={change.key}
                        className="flex items-center justify-between gap-3 border-b border-line-soft/60 py-[3px] font-mono text-[7.5px]"
                      >
                        <span className="shrink-0 text-zinc-500">{change.key}</span>
                        <span className="flex min-w-0 items-center justify-end gap-1">
                          <span className="max-w-[98px] truncate text-zinc-600 line-through">
                            {change.from}
                          </span>
                          <ArrowRight size={7} className="shrink-0 text-zinc-700" />
                          <span className="max-w-[108px] truncate text-acid/80" title={change.to}>
                            {change.to}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-[78px_1fr] gap-1">
                    <button
                      type="button"
                      onClick={discardPendingChange}
                      className="flex h-[25px] items-center justify-center border border-line bg-void font-mono text-[8px] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={applyPendingChange}
                      className="flex h-[25px] items-center justify-center gap-1 border border-acid/40 bg-acid px-2 text-[9px] font-medium text-[#0b0d04] transition-colors hover:bg-[#d7ff33]"
                    >
                      <Check size={9} />
                      Apply change
                    </button>
                  </div>
                  <p className="mt-1 font-mono text-[6.5px] leading-relaxed text-zinc-700">
                    Nothing is written to the scene until you confirm.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!connected && messages.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-6 text-center">
            <span className="grid h-8 w-8 place-items-center border border-line bg-void">
              <Bot size={15} className="text-zinc-600" />
            </span>
            <p className="text-[10px] text-zinc-500">Connect an agent provider to start.</p>
            <p className="font-mono text-[7.5px] leading-relaxed text-zinc-700">
              OpenAI-compatible, Anthropic, or a local Ollama endpoint. Attach files and images once
              the provider is online.
            </p>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-line bg-shell">
        <div className="flex h-[20px] items-center gap-1 border-b border-line-soft px-2 font-mono text-[6.5px] text-zinc-700">
          <span className="text-acid/45">ctx</span>
          <span className="truncate text-zinc-500">
            {node?.name ?? "MainApp"} · {node?.className ?? "AppRoot"}
          </span>
          <span className="text-zinc-800">/</span>
          <span className="truncate">{activeFile?.name ?? "MainApp.acid"}</span>
          <button
            type="button"
            onClick={() => {
              setRightTab("inspector");
            }}
            className="ml-auto shrink-0 hover:text-zinc-300"
          >
            inspect
          </button>
        </div>

        {attachments.length > 0 ? (
          <div className="scroll-thin flex max-h-[58px] flex-wrap items-center gap-1 overflow-y-auto border-b border-line-soft px-2 py-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex h-[24px] items-center gap-1 border border-line bg-void pl-1 pr-0.5"
              >
                {attachment.kind === "image" && attachment.dataUrl ? (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="h-4 w-4 object-cover"
                  />
                ) : (
                  <FileText size={9} className="text-zinc-600" />
                )}
                <span className="max-w-[130px] truncate font-mono text-[7px] text-zinc-500">
                  {attachment.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.id !== attachment.id),
                    )
                  }
                  className="grid h-4 w-4 place-items-center text-zinc-600 hover:text-danger"
                  aria-label={"Remove " + attachment.name}
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {attachError || chatError ? (
          <div className="flex items-start gap-1 border-b border-line-soft px-2 py-1 font-mono text-[7px] text-warn/80">
            <AlertCircle size={8} className="mt-[1px] shrink-0" />
            <span className="min-w-0 break-words">{attachError ?? chatError}</span>
          </div>
        ) : null}

        <div className="flex items-end gap-1 p-1.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.ts,.tsx,.js,.jsx,.json,.css,.html,.py,.yml,.yaml,.toml,.sh"
            onChange={(event) => void addFiles(event.target.files)}
            className="hidden"
          />
          <button
            type="button"
            title="Attach files or images"
            onClick={() => fileRef.current?.click()}
            className="grid h-[30px] w-[26px] shrink-0 place-items-center border border-line bg-panel text-zinc-500 hover:border-acid/25 hover:text-acid/80"
          >
            <Paperclip size={11} />
          </button>
          <div className="relative min-w-0 flex-1">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder={
                pendingChange
                  ? "Confirm or discard the staged scene change…"
                  : connected
                    ? "Ask Acid AI about this scene…"
                    : "Connect a provider to start chatting…"
              }
              className="scroll-thin h-[46px] w-full resize-none border border-line bg-void px-1.5 py-1 pr-6 text-[10px] leading-[1.5] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-acid/35"
            />
            <div className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-1 font-mono text-[6px] text-zinc-700">
              <ImageIcon size={7} />
              {attachments.filter((item) => item.kind === "image").length}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void send()}
            disabled={
              sending ||
              Boolean(pendingChange) ||
              !connected ||
              (!draft.trim() && attachments.length === 0)
            }
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center border border-acid/40 bg-acid text-[#0b0d04] transition-colors hover:bg-[#d7ff33] disabled:cursor-not-allowed disabled:border-line disabled:bg-elevated disabled:text-zinc-600"
            aria-label="Send message"
          >
            {sending ? (
              <span className="h-[10px] w-[10px] animate-spin rounded-full border border-[#0b0d04]/30 border-t-[#0b0d04]" />
            ) : (
              <Send size={11} />
            )}
          </button>
        </div>
        <div className="flex h-[15px] items-center gap-2 px-2 font-mono text-[6px] text-zinc-700">
          <span>
            {pendingChange ? "confirm staged change to continue" : "Enter send · Shift+Enter newline"}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <span className={cx("h-[3px] w-[3px] rounded-full", connected ? "bg-acid/50" : "bg-zinc-700")} />
            {connected ? "provider attached" : "provider offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
