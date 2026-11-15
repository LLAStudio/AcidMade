import { useEffect, useMemo, useRef } from "react";
import {
  Bot,
  Boxes,
  BrainCircuit,
  ChevronRight,
  Cpu,
  Gauge,
  MessageSquare,
  Plus,
  Radio,
  Sparkles,
  Waypoints,
  Zap,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { flattenScene } from "../data/scene";
import { AGENT_DEFAULTS } from "../data/nodeProps";
import { NODE_KIND_META, STATUS_META, agentTone } from "./nodeMeta";
import { cx } from "../lib/utils";
import type { SceneNode } from "../types";

function agentTask(node: SceneNode, active: boolean) {
  if (node.id === "data-analyst-agent") {
    return active ? "validating res://scenes/DashboardPage.acid" : "awaiting play session · 0 queued intents";
  }
  if (node.id === "auth-super-agent") {
    return active ? "auditing workspace session contract" : "session policy valid · standing by";
  }
  return active ? "executing assigned tool loop" : "idle · no active intent";
}

export function AgentHubView() {
  const {
    tree,
    nodeStatuses,
    selectedNodeId,
    selectNode,
    setRightTab,
    setNodeModalOpen,
    setAiOpen,
    openFile,
    run,
    logs,
    runtime,
  } = useEngine();

  const channelRef = useRef<HTMLDivElement | null>(null);
  const agents = useMemo(
    () => flattenScene(tree).filter((node) => node.kind === "agent"),
    [tree],
  );
  const active = agents.filter((node) => nodeStatuses[node.id] === "running").length;
  const selected = agents.find((node) => node.id === selectedNodeId);
  const agentLogs = logs.filter(
    (entry) =>
      entry.agent !== "AcidEngine" ||
      entry.level === "warn" ||
      entry.level === "error" ||
      entry.tool,
  );
  const running = run.status === "running" || run.status === "building";
  const steps = Math.max(1, Math.round((run.progress / 100) * 25));

  useEffect(() => {
    const node = channelRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [logs.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-void">
      <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
        <Bot size={12} className="text-acid/80" />
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px]">
          <span className="text-zinc-300">Agent Hub</span>
          <span className="hidden text-zinc-700 xl:inline">/</span>
          <span className="hidden font-mono text-[9px] text-zinc-600 xl:inline">swarm monitor</span>
        </div>
        <span className="hidden border border-line bg-void px-1 font-mono text-[7px] uppercase tracking-[0.08em] text-zinc-600 xl:inline">
          live
        </span>
        <span className="hidden items-center gap-1 font-mono text-[8px] text-zinc-700 xl:flex">
          <span className={cx("h-1 w-1 rounded-full", runtime.status === "online" ? "bg-acid/60 live-dot" : "bg-warn/70")} />
          {runtime.status === "online" ? "runtime online" : "reference runtime"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="flex h-[21px] items-center gap-1 border border-acid/25 bg-acid/[0.05] px-1.5 text-[9px] text-acid/80 hover:bg-acid/[0.1]"
          >
            <MessageSquare size={9} />
            Open Acid AI
          </button>
          <button
            type="button"
            onClick={() => setNodeModalOpen(true)}
            className="flex h-[21px] items-center gap-1 border border-line px-1.5 font-mono text-[8px] text-zinc-500 hover:border-acid/25 hover:text-acid/80"
          >
            <Plus size={8} />
            Spawn agent
          </button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-line bg-shell/50">
        {[
          {
            label: "Active agents",
            value: String(active).padStart(2, "0"),
            hint: active > 0 ? "executing" : "standing by",
            icon: Zap,
            tone: active > 0 ? "text-acid" : "text-zinc-500",
          },
          {
            label: "Registry",
            value: String(agents.length).padStart(2, "0"),
            hint: "super-agent nodes",
            icon: Bot,
            tone: "text-zinc-400",
          },
          {
            label: "Runtime steps",
            value: running ? steps + "/25" : "—",
            hint: run.currentAgent ?? "no active loop",
            icon: Gauge,
            tone: "text-[#38BDF8]",
          },
          {
            label: "Tool capability",
            value: String(runtime.info?.tools.length ?? 7),
            hint: runtime.info?.mode ?? "local tools",
            icon: Cpu,
            tone: "text-[#A3E635]",
          },
        ].map((cell) => {
          const Icon = cell.icon;
          return (
            <div key={cell.label} className="flex h-[42px] items-center gap-2 border-r border-line/60 px-2.5 last:border-0">
              <span className="grid h-6 w-6 place-items-center border border-line bg-void">
                <Icon size={11} className={cell.tone} />
              </span>
              <div className="min-w-0 leading-none">
                <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-zinc-700">
                  {cell.label}
                </div>
                <div className={cx("mt-1 font-mono text-[12px]", cell.tone)}>{cell.value}</div>
              </div>
              <span className="ml-auto hidden truncate font-mono text-[7px] text-zinc-700 xl:block">
                {cell.hint}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="scroll-thin min-w-0 flex-1 overflow-y-auto p-2">
          <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
            <span className="label-caps text-[8px] text-zinc-600">Swarm nodes</span>
            <span className="font-mono text-[7px] text-zinc-700">{agents.length} registered</span>
            <span className="ml-auto flex items-center gap-1 font-mono text-[7px] text-zinc-700">
              <span className="h-1 w-1 rounded-full bg-acid/50" />
              provider · BYOK / Ollama
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {agents.map((node) => {
              const status = nodeStatuses[node.id] ?? node.status;
              const statusMeta = STATUS_META[status];
              const meta = NODE_KIND_META[node.kind];
              const isRunning = status === "running";
              const isSelected = selectedNodeId === node.id;
              const lastLog = [...logs].reverse().find((entry) => entry.agent === node.name);
              const signals = node.signals.length;
              const progress = isRunning ? run.progress : 12;
              return (
                <article
                  key={node.id}
                  className={cx(
                    "group border bg-panel/90 transition-colors",
                    isSelected
                      ? "border-acid/60"
                      : isRunning
                        ? "border-acid/25"
                        : "border-line hover:border-zinc-600",
                  )}
                >
                  <div className="flex items-start gap-2 border-b border-line-soft px-2 py-1.5">
                    <span
                      className={cx(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-[2px] border",
                        meta.border,
                        meta.bg,
                      )}
                    >
                      <Bot size={13} className={meta.iconColor} />
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        selectNode(node.id);
                        setRightTab("inspector");
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-semibold text-zinc-100">
                          {node.name}
                        </span>
                        <ChevronRight size={9} className="text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-[1px] flex items-center gap-1.5">
                        <span className="font-mono text-[7.5px] text-zinc-600">{node.className}</span>
                        <span className="text-zinc-800">·</span>
                        <span className={cx("flex items-center gap-1 font-mono text-[7.5px]", statusMeta.text)}>
                          <span className={cx("h-[3px] w-[3px] rounded-full", statusMeta.dot)} />
                          {statusMeta.label}
                        </span>
                      </div>
                    </button>
                    <span className="shrink-0 border border-acid/20 bg-acid/[0.04] px-1 font-mono text-[6.5px] uppercase tracking-[0.06em] text-acid/55">
                      full-acid
                    </span>
                  </div>

                  <div className="px-2 py-1.5">
                    <p className="truncate font-mono text-[8px] text-zinc-500">
                      {lastLog?.message ?? agentTask(node, isRunning)}
                    </p>

                    <div className="mt-1.5 grid grid-cols-3 gap-1">
                      <div className="border border-line/60 bg-void/50 px-1.5 py-1">
                        <div className="font-mono text-[6.5px] uppercase tracking-[0.08em] text-zinc-700">model</div>
                        <div className="mt-[2px] truncate font-mono text-[7.5px] text-zinc-500">
                          {AGENT_DEFAULTS.model as string}
                        </div>
                      </div>
                      <div className="border border-line/60 bg-void/50 px-1.5 py-1">
                        <div className="font-mono text-[6.5px] uppercase tracking-[0.08em] text-zinc-700">memory</div>
                        <div className="mt-[2px] truncate font-mono text-[7.5px] text-zinc-500">project-wide</div>
                      </div>
                      <div className="border border-line/60 bg-void/50 px-1.5 py-1">
                        <div className="font-mono text-[6.5px] uppercase tracking-[0.08em] text-zinc-700">signals</div>
                        <div className="mt-[2px] truncate font-mono text-[7.5px] text-[#A3E635]/70">
                          {signals} wired
                        </div>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1">
                      {["fs.write", "tsc", "signals"].map((tool) => (
                        <span
                          key={tool}
                          className="border border-line bg-void px-1 font-mono text-[6.5px] text-zinc-600"
                        >
                          {tool}
                        </span>
                      ))}
                      <span className="ml-auto font-mono text-[7px] text-zinc-700">
                        {isRunning ? "step " + steps + "/25" : "step 0/25"}
                      </span>
                    </div>
                    <div className="mt-1 h-[2px] overflow-hidden bg-white/[0.06]">
                      <div
                        className={cx("h-full transition-all duration-500", isRunning ? "bg-acid" : "bg-zinc-700")}
                        style={{ width: progress + "%" }}
                      />
                    </div>
                  </div>

                  <div className="flex h-[23px] items-center border-t border-line-soft px-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        selectNode(node.id);
                        setRightTab("inspector");
                      }}
                      className="flex h-[17px] items-center gap-1 px-1 font-mono text-[7.5px] text-zinc-600 hover:bg-elevated hover:text-zinc-300"
                    >
                      <BrainCircuit size={8} />
                      inspect
                    </button>
                    {node.file ? (
                      <button
                        type="button"
                        onClick={() => {
                          selectNode(node.id);
                          if (node.file) openFile(node.file);
                        }}
                        className="ml-0.5 flex h-[17px] items-center gap-1 px-1 font-mono text-[7.5px] text-zinc-600 hover:bg-elevated hover:text-zinc-300"
                      >
                        <Waypoints size={8} />
                        prompt
                      </button>
                    ) : null}
                    <span className="ml-auto flex items-center gap-1 font-mono text-[6.5px] text-zinc-700">
                      <span className={cx("h-1 w-1 rounded-full", isRunning ? "bg-acid live-dot" : "bg-zinc-700")} />
                      {isRunning ? "autonomous" : "standby"}
                    </span>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              onClick={() => setNodeModalOpen(true)}
              className="flex min-h-[154px] flex-col items-center justify-center gap-2 border border-dashed border-line bg-transparent text-zinc-600 transition-colors hover:border-acid/30 hover:bg-acid/[0.025] hover:text-acid/70"
            >
              <span className="grid h-7 w-7 place-items-center border border-line bg-void">
                <Plus size={13} />
              </span>
              <span className="font-mono text-[9px]">spawn super-agent</span>
              <span className="font-mono text-[7px] text-zinc-700">autonomous · tools · memory</span>
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { label: "Signal bus", value: "10 edges", icon: Radio, tone: "text-[#A3E635]" },
              { label: "Scene root", value: "MainApp", icon: Boxes, tone: "text-[#FACC15]" },
              { label: "Provider", value: "BYOK · Ollama", icon: Sparkles, tone: "text-acid" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex h-[30px] items-center gap-2 border border-line bg-panel px-2">
                  <Icon size={10} className={item.tone} />
                  <div className="leading-none">
                    <div className="font-mono text-[6.5px] uppercase tracking-[0.1em] text-zinc-700">
                      {item.label}
                    </div>
                    <div className="mt-[3px] font-mono text-[8px] text-zinc-500">{item.value}</div>
                  </div>
                  <ChevronRight size={9} className="ml-auto text-zinc-800" />
                </div>
              );
            })}
          </div>
        </div>

        <aside className="hidden w-[270px] shrink-0 flex-col border-l border-line bg-panel xl:flex">
          <div className="flex h-[26px] shrink-0 items-center gap-1.5 border-b border-line px-2">
            <Radio size={9} className="text-acid/60" />
            <span className="label-caps text-[7.5px] text-zinc-500">Agent channel</span>
            <span className="ml-auto flex items-center gap-1 font-mono text-[6.5px] text-acid/45">
              <span className={cx("h-1 w-1 rounded-full", running ? "bg-acid live-dot" : "bg-zinc-700")} />
              {running ? "streaming" : "attached"}
            </span>
          </div>

          <div ref={channelRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto py-1">
            {agentLogs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <Bot size={16} className="text-zinc-700" />
                <p className="text-[10px] text-zinc-500">No agent traffic yet.</p>
                <p className="font-mono text-[7.5px] leading-relaxed text-zinc-700">
                  Play the scene or open Acid AI to start a stream.
                </p>
              </div>
            ) : (
              agentLogs.slice(-70).map((entry) => (
                <div
                  key={entry.id}
                  className="animate-stream-in border-b border-line-soft/50 px-2 py-[3px] font-mono text-[7.5px] leading-relaxed last:border-0"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-700">{entry.time}</span>
                    <span className={cx("truncate", agentTone(entry.agent))}>{entry.agent}</span>
                    {entry.tool ? (
                      <span className="ml-auto shrink-0 border border-line bg-void px-1 text-[6.5px] text-zinc-600">
                        {entry.tool}
                      </span>
                    ) : null}
                  </div>
                  <p className={cx("mt-[1px] break-words", entry.level === "error" ? "text-danger/80" : entry.level === "warn" ? "text-warn/80" : "text-zinc-500")}>
                    {entry.message}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 border-t border-line px-2 py-2">
            <div className="mb-1 flex items-center gap-1 font-mono text-[7px] text-zinc-700">
              <span>provider settings</span>
              <span className="ml-auto text-acid/40">BYOK ready</span>
            </div>
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="flex w-full items-center justify-center gap-1 border border-acid/25 bg-acid/[0.04] py-1 text-[9px] text-acid/75 hover:bg-acid/[0.09]"
            >
              <Sparkles size={9} />
              Open AI agent chat
            </button>
          </div>
        </aside>
      </div>

      <div className="flex h-[19px] shrink-0 items-center gap-2 border-t border-line-soft bg-shell px-2 font-mono text-[7px] text-zinc-700">
        <Bot size={8} className="text-acid/40" />
        <span>{agents.length} super-agents</span>
        <span className="text-zinc-800">|</span>
        <span className={running ? "text-acid/55" : ""}>{running ? "loop executing" : "swarm idle"}</span>
        <span className="ml-auto">
          {selected?.name ?? "select a node"} · {run.progress}%
        </span>
      </div>
    </div>
  );
}
