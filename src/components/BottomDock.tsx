import { useEffect, useRef } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Bug,
  CheckCircle2,
  ChevronDown,
  FileDiff,
  Hammer,
  SquareTerminal,
  Terminal as TerminalIcon,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { agentTone } from "./nodeMeta";
import type { DockTab, LogEntry, LogLevel, RunStatus } from "../types";
import { cx } from "../lib/utils";

const TABS: { id: DockTab; label: string; icon: LucideIcon }[] = [
  { id: "output", label: "Output", icon: TerminalIcon },
  { id: "stream", label: "Agent Stream", icon: Bot },
  { id: "debugger", label: "Debugger", icon: Bug },
  { id: "build", label: "Build Logs", icon: Hammer },
  { id: "terminal", label: "Terminal", icon: SquareTerminal },
];

const RUN_STATUS: Record<RunStatus, { label: string; dot: string; text: string }> = {
  idle: { label: "ready", dot: "bg-zinc-600", text: "text-zinc-500" },
  building: { label: "running", dot: "bg-acid status-pulse", text: "text-acid" },
  running: { label: "live", dot: "bg-acid", text: "text-acid/80" },
  deploying: { label: "exporting", dot: "bg-[#38BDF8] live-dot", text: "text-[#38BDF8]" },
  deployed: { label: "staged", dot: "bg-acid", text: "text-acid/80" },
  halted: { label: "halted", dot: "bg-danger", text: "text-danger" },
  failed: { label: "failed", dot: "bg-danger", text: "text-danger" },
};

const MESSAGE_TONE: Record<LogLevel, string> = {
  info: "text-zinc-400",
  ok: "text-zinc-300",
  warn: "text-warn/90",
  error: "text-danger/90",
  action: "text-zinc-200",
  muted: "text-zinc-600",
};

function LogRow({ entry }: { entry: LogEntry }) {
  return (
    <div className="flex min-h-[16px] items-start gap-1.5 px-2 py-[1px] font-mono text-[10.5px] leading-[16px] hover:bg-white/[0.022]">
      <span className="shrink-0 select-none text-zinc-700">[{entry.time}]</span>
      <span className={cx("w-[86px] shrink-0 truncate", agentTone(entry.agent))}>
        [{entry.agent}]
      </span>
      {entry.tool ? (
        <span className="mt-[1px] shrink-0 border border-line bg-void px-1 text-[8px] leading-[11px] text-zinc-600">
          {entry.tool}
        </span>
      ) : null}
      {entry.channel === "build" ? (
        <span className="mt-[1px] shrink-0 border border-[#38BDF8]/20 bg-[#38BDF8]/[0.04] px-1 text-[8px] leading-[11px] text-[#38BDF8]/60">
          build
        </span>
      ) : null}
      <span className={cx("min-w-0 whitespace-pre-wrap break-words", MESSAGE_TONE[entry.level])}>
        {entry.message}
      </span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex h-full min-h-[66px] flex-col items-center justify-center gap-1.5 px-4 text-center">
      <span className="grid h-6 w-6 place-items-center border border-line bg-void">
        <Icon size={11} className="text-zinc-600" />
      </span>
      <p className="text-[10px] text-zinc-500">{title}</p>
      <p className="font-mono text-[8.5px] text-zinc-700">{hint}</p>
    </div>
  );
}

function DiffsStrip() {
  const { diffs } = useEngine();
  if (diffs.length === 0) return null;
  return (
    <div className="flex h-[21px] shrink-0 items-center gap-1 overflow-x-auto border-b border-line-soft bg-[#0b0d0f] px-2 scroll-thin">
      <FileDiff size={8} className="shrink-0 text-zinc-700" />
      <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.08em] text-zinc-700">
        changed files
      </span>
      {diffs.map((diff) => (
        <span
          key={diff.id}
          className="flex shrink-0 items-center gap-1 border border-line bg-void px-1 py-[1px] font-mono text-[8px] text-zinc-500"
          title={diff.preview.join("\n")}
        >
          <span className="max-w-[190px] truncate">{diff.path}</span>
          <span className="text-[#A3E635]/60">+{diff.additions}</span>
          {diff.deletions > 0 ? <span className="text-danger/60">−{diff.deletions}</span> : null}
        </span>
      ))}
    </div>
  );
}

export function BottomDock() {
  const {
    state,
    setDockTab,
    toggleDock,
    clearLogs,
    refreshRuntime,
  } = useEngine();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const runStatus = RUN_STATUS[state.run.status];
  const busy = state.run.status === "building" || state.run.status === "deploying";
  const openProblems = state.problems.filter((problem) => !problem.healed).length;
  const buildLogs = state.logs.filter((entry) => entry.channel === "build");
  const agentLogs = state.logs.filter((entry) => entry.agent !== "AcidEngine");
  const toolLogs = state.logs.filter((entry) => Boolean(entry.tool));

  useEffect(() => {
    if (!state.dockOpen) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [state.logs.length, state.dockTab, state.dockOpen]);

  const badge = (tab: DockTab) => {
    if (tab === "debugger" && openProblems > 0) {
      return (
        <span className="rounded-[1px] bg-danger/15 px-1 font-mono text-[8px] text-danger">
          {openProblems}
        </span>
      );
    }
    if (tab === "build" && buildLogs.length > 0) {
      return (
        <span className="rounded-[1px] border border-line bg-void px-1 font-mono text-[8px] text-zinc-600">
          {buildLogs.length}
        </span>
      );
    }
    if (tab === "terminal" && toolLogs.length > 0) {
      return (
        <span className="rounded-[1px] border border-line bg-void px-1 font-mono text-[8px] text-zinc-700">
          {toolLogs.length}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0b0d0f]">
      <div className="flex h-[27px] shrink-0 items-stretch border-b border-line bg-panel">
        <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto scroll-thin">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = state.dockTab === tab.id && state.dockOpen;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDockTab(tab.id)}
                className={cx(
                  "relative flex h-full shrink-0 items-center gap-1.5 border-r border-line px-2 text-[10.5px] transition-colors xl:px-2.5",
                  active
                    ? "bg-[#0b0d0f] text-zinc-200"
                    : "bg-panel text-zinc-500 hover:bg-elevated hover:text-zinc-300",
                )}
              >
                {active ? <span className="absolute left-0 right-0 top-0 h-[1.5px] bg-acid" /> : null}
                <Icon size={9} className={cx("hidden shrink-0 xl:block", active ? "text-acid/80" : "text-zinc-600")} />
                <span className="xl:hidden">{tab.label.replace("Agent Stream", "Stream").replace("Build Logs", "Build")}</span>
                <span className="hidden xl:inline">{tab.label}</span>
                {badge(tab.id)}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 px-1.5">
          {busy && state.run.currentAgent ? (
            <span className="hidden max-w-[112px] truncate font-mono text-[8.5px] text-zinc-600 2xl:inline">
              {state.run.currentAgent} · step {Math.max(1, Math.round((state.run.progress / 100) * 25))}
            </span>
          ) : null}
          {busy ? (
            <div className="hidden items-center gap-1 sm:flex">
              <div className="h-[2px] w-[54px] overflow-hidden bg-white/[0.08]">
                <div
                  className="h-full bg-acid transition-all duration-500"
                  style={{ width: state.run.progress + "%" }}
                />
              </div>
              <span className="w-6 font-mono text-[8.5px] text-zinc-600">{state.run.progress}%</span>
            </div>
          ) : null}
          <span
            className={cx(
              "flex items-center gap-1 border border-line bg-void px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.08em]",
              runStatus.text,
            )}
          >
            <span className={cx("h-[3px] w-[3px] rounded-full", runStatus.dot)} />
            {state.agentsPaused ? "paused" : runStatus.label}
          </span>
          <button
            type="button"
            onClick={clearLogs}
            disabled={state.logs.length === 0}
            title="Clear output"
            className="grid h-5 w-5 place-items-center border border-transparent text-zinc-600 hover:border-line hover:bg-elevated hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 size={9} />
          </button>
          <button
            type="button"
            onClick={toggleDock}
            title={state.dockOpen ? "Collapse output" : "Expand output"}
            className="grid h-5 w-5 place-items-center border border-transparent text-zinc-600 hover:border-line hover:bg-elevated hover:text-zinc-300"
          >
            <ChevronDown
              size={11}
              className={cx("transition-transform", !state.dockOpen && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {!state.dockOpen ? (
        <div className="flex h-[16px] items-center gap-2 px-2 font-mono text-[8px] text-zinc-700">
          <span className="text-acid/40">●</span>
          output collapsed · press a tab to expand
          <button type="button" onClick={toggleDock} className="ml-auto hover:text-zinc-300">
            expand
          </button>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-1">
            {state.dockTab === "output" ? (
              <div className="select-text">
                <div className="flex h-[16px] items-center gap-2 border-b border-line-soft/60 px-2 font-mono text-[8.5px] text-zinc-700">
                  <span className="text-zinc-500">AcidMade Engine v0.9.2.stable.official</span>
                  <span>·</span>
                  <span>scene runtime 0.9.2</span>
                  <span className="ml-auto">https://acidmade.local</span>
                </div>
                {state.logs.length === 0 ? (
                  <EmptyState
                    icon={TerminalIcon}
                    title="No output in this session."
                    hint="Press Play or open Acid AI to start producing engine output."
                  />
                ) : (
                  state.logs.map((entry) => <LogRow key={entry.id} entry={entry} />)
                )}
                {busy && state.run.currentAgent ? (
                  <div className="flex min-h-[16px] items-center gap-1.5 px-2 py-[1px] font-mono text-[10.5px]">
                    <span className="w-[55px] shrink-0 text-zinc-800">[...]</span>
                    <span className={cx("w-[86px] shrink-0 truncate", agentTone(state.run.currentAgent))}>
                      [{state.run.currentAgent}]
                    </span>
                    <span className="text-zinc-600">
                      executing tool loop
                      <span className="caret" />
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {state.dockTab === "stream" ? (
              <div className="select-text">
                <div className="flex h-[16px] items-center gap-2 border-b border-line-soft/60 px-2 font-mono text-[8.5px] text-zinc-700">
                  <span className="text-acid/50">agent channel open</span>
                  <span>·</span>
                  <span>super-agent execution stream</span>
                  <span className="ml-auto">{agentLogs.length} lines</span>
                </div>
                {agentLogs.length === 0 ? (
                  <EmptyState
                    icon={Bot}
                    title="No agent stream in this session."
                    hint="Run the scene or start a chat with Acid AI."
                  />
                ) : (
                  agentLogs.map((entry) => <LogRow key={entry.id} entry={entry} />)
                )}
              </div>
            ) : null}

            {state.dockTab === "debugger" ? (
              <div className="select-text">
                <div className="flex h-[18px] items-center gap-2 border-b border-line-soft/60 bg-[#0b0d0f] px-2 font-mono text-[8px] uppercase tracking-[0.08em] text-zinc-700">
                  <AlertTriangle size={8} className={openProblems > 0 ? "text-danger" : "text-[#A3E635]/60"} />
                  <span>{openProblems} open diagnostics</span>
                  <span className="text-zinc-800">|</span>
                  <span>tsc --noEmit · scene contract</span>
                  <span className="ml-auto">auto-heal armed</span>
                </div>
                {state.problems.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No diagnostics."
                    hint="Last scene typecheck clean · signal contracts resolved."
                  />
                ) : (
                  state.problems.map((problem) => (
                    <div
                      key={problem.id}
                      className="flex items-start gap-2 border-b border-line-soft/60 px-2 py-1 hover:bg-white/[0.015]"
                    >
                      {problem.severity === "error" ? (
                        <AlertCircle size={10} className="mt-[1px] shrink-0 text-danger" />
                      ) : (
                        <AlertTriangle size={10} className="mt-[1px] shrink-0 text-warn" />
                      )}
                      <span className="shrink-0 border border-line bg-void px-1 font-mono text-[8px] text-zinc-500">
                        {problem.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10.5px] text-zinc-400">
                        {problem.message}
                      </span>
                      <span className="shrink-0 font-mono text-[8.5px] text-zinc-600">
                        {problem.file}:{problem.line}
                      </span>
                      <span
                        className={cx(
                          "shrink-0 border px-1 font-mono text-[8px]",
                          problem.healed
                            ? "border-[#A3E635]/20 bg-[#A3E635]/[0.04] text-[#A3E635]/70"
                            : "border-danger/25 bg-danger/[0.05] text-danger/80",
                        )}
                      >
                        {problem.healed ? "healed" : "open"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {state.dockTab === "build" ? (
              <div className="select-text">
                <DiffsStrip />
                <div className="flex h-[17px] items-center gap-2 border-b border-line-soft/60 px-2 font-mono text-[8.5px] text-zinc-700">
                  <Hammer size={8} className="text-[#38BDF8]/60" />
                  <span>build pipeline</span>
                  <span className="text-zinc-800">|</span>
                  <span>{state.problems.filter((problem) => !problem.healed).length} diagnostics</span>
                  <span className="ml-auto">{state.run.progress}% complete</span>
                </div>
                {buildLogs.length === 0 ? (
                  <EmptyState
                    icon={Hammer}
                    title="No build output in this session."
                    hint="Press Play to stream esbuild and tsc into this panel."
                  />
                ) : (
                  buildLogs.map((entry) => <LogRow key={entry.id} entry={entry} />)
                )}
              </div>
            ) : null}

            {state.dockTab === "terminal" ? (
              <div className="select-text">
                <div className="flex h-[17px] items-center gap-2 border-b border-line-soft/60 px-2 font-mono text-[8.5px] text-zinc-700">
                  <TerminalIcon size={8} className="text-[#A3E635]/60" />
                  <span>acidmadectl</span>
                  <span className="text-zinc-800">|</span>
                  <span>res://northwind-analytics</span>
                  <span className="ml-auto">pty 03</span>
                </div>
                <div className="px-2 py-1 font-mono text-[10px] leading-[16px] text-zinc-500">
                  <div>
                    <span className="text-acid/60">acidmade@engine</span>
                    <span className="text-zinc-600"> res://northwind-analytics $ </span>
                    <span className="text-zinc-300">
                      {state.run.session > 0 ? "acidmadectl play --scene MainApp.acid" : "acidmadectl status"}
                    </span>
                  </div>
                  {toolLogs.length === 0 ? (
                    <div className="mt-1 text-zinc-700">
                      runtime ready · type a command or press Play to attach a tool loop
                    </div>
                  ) : (
                    toolLogs.slice(-40).map((entry) => (
                      <div key={entry.id} className="flex gap-1.5">
                        <span className="shrink-0 text-zinc-700">[{entry.time}]</span>
                        <span className="shrink-0 text-[#A3E635]/60">$ {entry.tool}</span>
                        <span className="min-w-0 truncate text-zinc-600">{entry.message}</span>
                      </div>
                    ))
                  )}
                  <div className="mt-1 flex items-center gap-1 text-zinc-600">
                    <span className="text-acid/60">res://northwind-analytics</span>
                    <span>&gt;</span>
                    <span className="caret" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex h-[15px] shrink-0 items-center justify-between border-t border-line-soft px-2 font-mono text-[8px] text-zinc-700">
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-500">
                {state.run.session > 0 ? "session #" + state.run.session : "no active session"}
              </span>
              <span className="text-zinc-800">|</span>
              <span>{state.logs.length} events</span>
            </span>
            <span className="flex items-center gap-2">
              {state.activeRunId ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-acid/70 live-dot" />
                  SSE · {state.activeRunId}
                </>
              ) : (
                <button
                  type="button"
                  onClick={refreshRuntime}
                  className="flex items-center gap-1 hover:text-zinc-400"
                  title="Re-probe local runtime"
                >
                  <span
                    className={cx(
                      "h-1 w-1 rounded-full",
                      state.runtime.status === "online" ? "bg-acid/60" : "bg-warn/70",
                    )}
                  />
                  runtime · {state.runtime.status === "online" ? "local" : "reference"}
                </button>
              )}
              <span className="text-zinc-800">|</span>
              <span>acidmade 0.9.2</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
