import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  Boxes,
  ChevronDown,
  Clapperboard,
  Code2,
  Command,
  FileDown,
  FlaskConical,
  FolderCog,
  Hammer,
  Info,
  Layers,
  Pause,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Settings2,
  Square,
  Sparkles,
  TerminalSquare,
  Waypoints,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { downloadDocumentation } from "../lib/docs";
import { NODE_CATALOG } from "../data/nodeCatalog";
import { countSceneNodes, findSceneNode } from "../data/scene";
import { cx } from "../lib/utils";
import type { EngineMode } from "../types";

const WORKSPACES: { id: EngineMode; label: string; icon: LucideIcon; key: string }[] = [
  { id: "viewport", label: "Viewport", icon: Boxes, key: "1" },
  { id: "script", label: "Script", icon: Code2, key: "2" },
  { id: "signals", label: "Signal Graph", icon: Waypoints, key: "3" },
  { id: "agents", label: "Agent Hub", icon: Bot, key: "4" },
];

interface MenuItem {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItem[];
}

function MenuButton({
  menu,
  open,
  onToggle,
}: {
  menu: MenuDef;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cx(
        "relative flex h-6 items-center gap-1 px-2 text-[11px] tracking-[0.01em] transition-colors",
        open
          ? "bg-elevated text-zinc-100"
          : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200",
      )}
    >
      {menu.label}
    </button>
  );
}

function Dropdown({
  menu,
  onClose,
  children,
}: {
  menu: MenuDef;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-[1px] w-[214px] border border-line bg-panel py-1 shadow-[0_12px_28px_rgba(0,0,0,0.55)]">
      {menu.items.map((item, index) => {
        const Icon = item.icon;
        if (item.separator) {
          return <div key={"sep-" + index} className="my-1 border-t border-line" />;
        }
        return (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.action();
              onClose();
            }}
            className="flex h-[23px] w-full items-center gap-2 px-2.5 text-left text-[10.5px] text-zinc-400 transition-colors hover:bg-elevated hover:text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent"
          >
            {Icon ? <Icon size={11} className="shrink-0 text-zinc-600" /> : <span className="w-[11px]" />}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut ? (
              <span className="font-mono text-[8px] text-zinc-600">{item.shortcut}</span>
            ) : null}
          </button>
        );
      })}
      {children}
    </div>
  );
}

function ControlButton({
  title,
  onClick,
  children,
  disabled,
  active,
  accent,
  wide,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex h-[24px] items-center justify-center gap-1 rounded-[2px] border transition-colors",
        wide ? "px-1.5" : "w-[24px]",
        accent
          ? "border-acid/35 bg-acid/[0.08] text-acid hover:border-acid/60 hover:bg-acid/[0.14]"
          : active
            ? "border-acid/25 bg-acid/[0.07] text-acid"
            : "border-transparent text-zinc-500 hover:border-line hover:bg-elevated hover:text-zinc-200",
        disabled && "cursor-not-allowed border-transparent text-zinc-700 hover:border-transparent hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}

export function EngineBar() {
  const {
    mode,
    setMode,
    project,
    projects,
    setProject,
    openLauncher,
    startBuild,
    runScene,
    stopRun,
    deploy,
    togglePause,
    canPause,
    canStop,
    agentsPaused,
    run,
    setDockTab,
    toggleDock,
    setNodeModalOpen,
    setPalette,
    setAiOpen,
    aiOpen,
    setRightTab,
    selectNode,
    openFile,
    pushLog,
    setZoom,
    refreshRuntime,
    runtime,
    tree,
    selectedNodeId,
    resetWorkspace,
  } = useEngine();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const busy = run.status === "building" || run.status === "deploying";
  const running = run.status === "running" || busy;
  const selectedNode = findSceneNode(tree, selectedNodeId);

  useEffect(() => {
    if (!openMenu) return;
    const close = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [openMenu]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (typing) return;
      if (event.key === "F5") {
        event.preventDefault();
        startBuild();
      } else if (event.key === "F6") {
        event.preventDefault();
        togglePause();
      } else if (event.key === "F7") {
        event.preventDefault();
        stopRun();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette, startBuild, stopRun, togglePause]);

  const menus: MenuDef[] = [
    {
      label: "Scene",
      items: [
        { label: "Create New Node", icon: Plus, shortcut: "N", action: () => setNodeModalOpen(true) },
        {
          label: "Attach Script",
          icon: Code2,
          action: () => {
            if (selectedNode?.file) openFile(selectedNode.file);
            else pushLog("AcidEngine", "warn", "selected node has no script attached");
          },
        },
        { label: "Save Scene", shortcut: "Ctrl+S", action: () => pushLog("AcidEngine", "ok", "saved res://scenes/MainApp.acid") },
        { separator: true, label: "sep", action: () => undefined },
        { label: "Select Root", icon: Boxes, action: () => selectNode("main-app") },
        { label: "Close Tabs", icon: X, action: () => pushLog("AcidEngine", "info", "scene tabs retained · dock session only") },
      ],
    },
    {
      label: "Project",
      items: [
        { label: "Projects & Files", icon: Layers, action: openLauncher },
        { label: "Project Settings", icon: FolderCog, action: () => { selectNode("main-app"); setRightTab("inspector"); } },
        { label: "Reimport Resources", icon: Layers, action: () => pushLog("AcidEngine", "info", "reimported 11 resources · acid/1.0") },
        { separator: true, label: "sep", action: () => undefined },
        ...projects.map((entry) => ({
          label: (entry.id === project.id ? "● " : "○ ") + entry.name,
          icon: Layers,
          action: () => setProject(entry),
        })),
        { separator: true, label: "sep", action: () => undefined },
        {
          label: "Reset Project to Defaults",
          icon: RotateCcw,
          action: () => setResetOpen(true),
          disabled: busy || run.status === "running",
        },
      ],
    },
    {
      label: "Build",
      items: [
        { label: busy ? "Building…" : "Play / Build & Run", icon: Play, shortcut: "F5", action: startBuild, disabled: busy },
        { label: agentsPaused ? "Resume Agents" : "Pause Agents", icon: agentsPaused ? Play : Pause, shortcut: "F6", action: togglePause, disabled: !canPause },
        { label: "Stop Execution", icon: Square, shortcut: "F7", action: stopRun, disabled: !canStop },
        { separator: true, label: "sep", action: () => undefined },
        { label: "Run Current Scene", icon: Clapperboard, action: runScene },
        { label: "Export Production", icon: Rocket, action: deploy, disabled: busy },
        { separator: true, label: "sep", action: () => undefined },
        { label: "Show Build Logs", icon: Hammer, action: () => setDockTab("build") },
        { label: "Show Debugger", icon: TerminalSquare, action: () => setDockTab("debugger") },
      ],
    },
    {
      label: "Agents",
      items: [
        { label: "Open Agent Hub", icon: Bot, action: () => setMode("agents") },
        { label: "Add Super-Agent", icon: Plus, action: () => setNodeModalOpen(true) },
        { label: "Open Acid AI", icon: Sparkles, action: () => setAiOpen(true) },
        { separator: true, label: "sep", action: () => undefined },
        { label: "Signal Graph", icon: Waypoints, action: () => setMode("signals") },
        { label: "Provider Settings", icon: Settings2, action: () => setAiOpen(true) },
      ],
    },
    {
      label: "Editor",
      items: [
        { label: "Toggle Output Panel", icon: TerminalSquare, action: toggleDock },
        { label: "Inspector", icon: Settings2, action: () => setRightTab("inspector") },
        { label: "Node & Signals", icon: Waypoints, action: () => setRightTab("node") },
        { separator: true, label: "sep", action: () => undefined },
        { label: "Command Palette", icon: Command, shortcut: "⌘K", action: () => setPalette(true) },
        { label: "Reset Canvas Zoom", action: () => setZoom(1) },
        { label: "Re-probe AI Runtime", action: refreshRuntime },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "Download Documentation (PDF)",
          icon: FileDown,
          action: () => {
            downloadDocumentation();
            pushLog("AcidEngine", "info", "documentation PDF · AcidMade-Documentation.pdf");
          },
        },
        { label: "Engine Documentation", icon: Info, action: () => pushLog("AcidEngine", "info", "docs · res://docs/acidmade-engine.md") },
        { label: "Scene Format · acid/1.0", icon: Layers, action: () => pushLog("AcidEngine", "info", "scene schema → res://acid.config.json") },
        { label: "About AcidMade", icon: FlaskConical, action: () => setAboutOpen(true) },
      ],
    },
  ];

  return (
    <>
      <div
        ref={barRef}
        className="relative z-40 flex h-9 shrink-0 items-center border-b border-line bg-shell px-2"
      >
        <div className="flex shrink-0 items-center gap-2 pr-2">
          <span className="grid h-[21px] w-[21px] place-items-center rounded-[2px] bg-acid shadow-[0_0_12px_rgba(204,255,0,0.16)]">
            <FlaskConical size={12} strokeWidth={2.4} className="text-[#0a0c04]" />
          </span>
          <span className="text-[11px] font-semibold tracking-[-0.01em] text-zinc-100">AcidMade</span>
          <span className="hidden font-mono text-[8px] uppercase tracking-[0.12em] text-acid/50 xl:inline">
            engine
          </span>
        </div>

        <div className="flex shrink-0 items-center border-l border-line/70 pl-1">
          {menus.map((menu) => (
            <div key={menu.label} className="relative">
              <MenuButton
                menu={menu}
                open={openMenu === menu.label}
                onToggle={() => setOpenMenu((value) => (value === menu.label ? null : menu.label))}
              />
              {openMenu === menu.label ? (
                <Dropdown menu={menu} onClose={() => setOpenMenu(null)} />
              ) : null}
            </div>
          ))}
        </div>

        <div className="mx-2 hidden h-4 w-px shrink-0 bg-line/80 xl:block" />
        <div className="hidden max-w-[150px] shrink-0 items-center gap-1 font-mono text-[9.5px] text-zinc-600 xl:flex">
          <span className="truncate">{project.slug}</span>
          <ChevronDown size={9} className="shrink-0" />
        </div>

        <div className="flex min-w-0 flex-1 justify-center px-2">
          <div className="flex h-[26px] items-center rounded-[2px] border border-line bg-panel p-[1px]">
            {WORKSPACES.map((workspace) => {
              const Icon = workspace.icon;
              const active = mode === workspace.id;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => setMode(workspace.id)}
                  aria-pressed={active}
                  title={workspace.label + "  [" + workspace.key + "]"}
                  className={cx(
                    "relative flex h-[22px] items-center gap-1.5 px-2 text-[11px] transition-colors",
                    active
                      ? "bg-elevated text-zinc-100"
                      : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-300",
                  )}
                >
                  {active ? (
                    <span className="absolute left-1 right-1 top-0 h-[1.5px] bg-acid" />
                  ) : null}
                  <Icon size={11} className={active ? "text-acid" : "text-zinc-600"} />
                  <span className="hidden xl:inline">{workspace.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="mr-1 flex items-center gap-0.5 rounded-[2px] border border-line bg-panel p-[2px]">
            <ControlButton
              title={busy ? "Building scene…" : "Play · build & run  (F5)"}
              onClick={startBuild}
              disabled={busy}
              active={running}
            >
              {busy ? (
                <span className="h-[10px] w-[10px] animate-spin rounded-full border border-acid/30 border-t-acid" />
              ) : (
                <Play size={11} strokeWidth={2.2} className={cx(running && "fill-acid/20")} />
              )}
            </ControlButton>
            <ControlButton
              title={agentsPaused ? "Resume agents  (F6)" : "Pause agents  (F6)"}
              onClick={togglePause}
              disabled={!canPause}
              active={agentsPaused}
            >
              {agentsPaused ? <Play size={11} /> : <Pause size={11} strokeWidth={2} />}
            </ControlButton>
            <ControlButton
              title="Stop execution  (F7)"
              onClick={stopRun}
              disabled={!canStop}
            >
              <Square size={10} strokeWidth={2.2} />
            </ControlButton>
            <span className="mx-0.5 h-3.5 w-px bg-line" />
            <ControlButton title="Run current scene" onClick={runScene} disabled={busy}>
              <Clapperboard size={11} />
            </ControlButton>
            <ControlButton
              title="Export · stage production build"
              onClick={deploy}
              disabled={busy}
              wide
            >
              <Rocket size={11} />
              <span className="hidden text-[10.5px] xl:inline">Export</span>
            </ControlButton>
          </div>

          <button
            type="button"
            onClick={() => setAiOpen(!aiOpen)}
            aria-pressed={aiOpen}
            title="Open Acid AI agent"
            className={cx(
              "relative flex h-[24px] items-center gap-1.5 rounded-[2px] border px-2 text-[11px] transition-colors",
              aiOpen
                ? "border-acid/70 bg-acid/[0.16] text-acid"
                : "border-acid/35 bg-acid/[0.06] text-acid hover:border-acid/60 hover:bg-acid/[0.12]",
            )}
          >
            <Sparkles size={11} strokeWidth={2.1} />
            <span className="font-medium">AI</span>
            <span className="h-[3px] w-[3px] rounded-full bg-acid" />
          </button>
        </div>
      </div>

      {resetOpen ? (
        <div
          className="fixed inset-0 z-[76] grid place-items-center bg-black/65 p-6"
          onMouseDown={() => setResetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-project-title"
            className="w-[360px] max-w-full border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-8 items-center justify-between border-b border-line px-2.5">
              <span id="reset-project-title" className="text-[11px] font-semibold text-zinc-200">
                Reset project
              </span>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200"
                aria-label="Close reset dialog"
              >
                <X size={12} />
              </button>
            </div>
            <div className="p-3.5">
              <div className="flex items-start gap-2">
                <span className="mt-[1px] grid h-[26px] w-[26px] shrink-0 place-items-center border border-danger/25 bg-danger/[0.06]">
                  <RotateCcw size={12} className="text-danger/80" />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-zinc-200">Restore the default workspace?</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    Added nodes and every inspector override will be removed. The built-in scene
                    tree and default tabs will be restored, and the saved workspace for this
                    browser will be reset.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  className="flex h-[27px] items-center justify-center border border-line bg-void text-[9px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetWorkspace();
                    setResetOpen(false);
                  }}
                  className="flex h-[27px] items-center justify-center gap-1 border border-danger/35 bg-danger/[0.08] text-[9px] font-medium text-danger/90 transition-colors hover:bg-danger/[0.14]"
                >
                  <RotateCcw size={10} />
                  Reset project
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {aboutOpen ? (
        <div
          className="fixed inset-0 z-[75] grid place-items-center bg-black/65 p-6"
          onMouseDown={() => setAboutOpen(false)}
        >
          <div
            className="w-[340px] border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-8 items-center justify-between border-b border-line px-2.5">
              <span className="text-[11px] font-semibold text-zinc-200">About AcidMade</span>
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200"
                aria-label="Close about"
              >
                <X size={12} />
              </button>
            </div>
            <div className="space-y-2 p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-[2px] bg-acid">
                  <FlaskConical size={16} className="text-[#0a0c04]" />
                </span>
                <div>
                  <div className="text-[12px] font-semibold text-zinc-100">AcidMade</div>
                  <div className="font-mono text-[9px] text-zinc-500">v2.0.0.stable · engine build 2261</div>
                </div>
              </div>
              <p className="text-[10.5px] leading-relaxed text-zinc-500">
                AI-native application engine. Node, Scene &amp; Signal architecture with a local
                tool-executing agent runtime and provider-agnostic AI agents.
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-2 font-mono text-[9px] text-zinc-600">
                <span>runtime</span>
                <span className={runtime.status === "online" ? "text-acid/80" : "text-warn"}>
                  {runtime.status} · {runtime.info?.planner ?? "local"}
                </span>
                <span>scene</span>
                <span className="text-zinc-400">acid/1.0</span>
                <span>project</span>
                <span className="truncate text-zinc-400">{project.slug}</span>
                <span>nodes</span>
                <span className="text-zinc-400">{countSceneNodes(tree)}</span>
                {NODE_CATALOG.map((group) => (
                  <span key={group.id} className="col-span-2 mt-1 text-zinc-700">
                    {group.label} · {group.classes.length} classes
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
