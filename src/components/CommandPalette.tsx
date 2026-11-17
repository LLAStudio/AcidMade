import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Boxes,
  Clapperboard,
  Code2,
  Command,
  Hammer,
  Layers,
  Pause,
  Play,
  Plus,
  Rocket,
  Search,
  Settings2,
  Sparkles,
  Square,
  TerminalSquare,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { flattenScene } from "../data/scene";
import { NODE_KIND_META, SCENE_ICONS } from "./nodeMeta";
import { cx } from "../lib/utils";

interface PaletteAction {
  id: string;
  label: string;
  hint: string;
  group: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
}

export function CommandPalette() {
  const {
    paletteOpen,
    setPalette,
    setMode,
    tree,
    selectNode,
    startBuild,
    stopRun,
    deploy,
    toggleDock,
    setDockTab,
    setAiOpen,
    setNodeModalOpen,
    togglePause,
    openLauncher,
    setSettings,
  } = useEngine();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    setQuery("");
    setIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [paletteOpen]);

  const actions = useMemo<PaletteAction[]>(() => {
    const commands: PaletteAction[] = [
      {
        id: "viewport",
        label: "Switch to Viewport",
        hint: "workspace · 1",
        group: "Workspace",
        icon: Boxes,
        keywords: "viewport scene canvas",
        run: () => setMode("viewport"),
      },
      {
        id: "script",
        label: "Switch to Script",
        hint: "workspace · 2",
        group: "Workspace",
        icon: Code2,
        keywords: "script code editor prompt",
        run: () => setMode("script"),
      },
      {
        id: "signals",
        label: "Switch to Signal Graph",
        hint: "workspace · 3",
        group: "Workspace",
        icon: Waypoints,
        keywords: "signals graph wiring",
        run: () => setMode("signals"),
      },
      {
        id: "agents",
        label: "Switch to Agent Hub",
        hint: "workspace · 4",
        group: "Workspace",
        icon: Bot,
        keywords: "agents swarm hub",
        run: () => setMode("agents"),
      },
      {
        id: "play",
        label: "Play / Build & Run",
        hint: "F5",
        group: "Engine",
        icon: Play,
        keywords: "play run build compile",
        run: startBuild,
      },
      {
        id: "pause",
        label: "Pause / Resume Agents",
        hint: "F6",
        group: "Engine",
        icon: Pause,
        keywords: "pause resume agents",
        run: togglePause,
      },
      {
        id: "stop",
        label: "Stop Execution",
        hint: "F7",
        group: "Engine",
        icon: Square,
        keywords: "stop halt abort",
        run: stopRun,
      },
      {
        id: "scene",
        label: "Run Current Scene",
        hint: "play scene",
        group: "Engine",
        icon: Clapperboard,
        keywords: "current scene run play",
        run: startBuild,
      },
      {
        id: "export",
        label: "Export Production Build",
        hint: "stage artifact",
        group: "Engine",
        icon: Rocket,
        keywords: "export deploy ship build",
        run: deploy,
      },
      {
        id: "node",
        label: "Create New Node",
        hint: "N",
        group: "Engine",
        icon: Plus,
        keywords: "add create node child",
        run: () => setNodeModalOpen(true),
      },
      {
        id: "ai",
        label: "Open Acid AI Agent",
        hint: "chat",
        group: "Engine",
        icon: Sparkles,
        keywords: "ai agent chat provider ollama openai",
        run: () => setAiOpen(true),
      },
      {
        id: "projects",
        label: "Projects & Files",
        hint: "launcher",
        group: "Project",
        icon: Layers,
        keywords: "projects launcher files manager open",
        run: openLauncher,
      },
      {
        id: "settings",
        label: "Open Settings",
        hint: "Ctrl+,",
        group: "Preferences",
        icon: Settings2,
        keywords: "settings preferences languages layout workspace",
        run: () => setSettings(true),
      },
      {
        id: "output",
        label: "Toggle Output Panel",
        hint: "console",
        group: "Editor",
        icon: TerminalSquare,
        keywords: "output console terminal dock",
        run: toggleDock,
      },
      {
        id: "build-logs",
        label: "Show Build Logs",
        hint: "console",
        group: "Editor",
        icon: Hammer,
        keywords: "build logs diagnostics",
        run: () => {
          setMode("viewport");
          setDockTab("build");
        },
      },
    ];

    const nodeActions: PaletteAction[] = flattenScene(tree).map((node) => ({
      id: "node-" + node.id,
      label: node.name,
      hint: node.className,
      group: "Nodes",
      icon: SCENE_ICONS[node.icon] ?? Boxes,
      keywords: (node.name + " " + node.className + " " + NODE_KIND_META[node.kind].label).toLowerCase(),
      run: () => selectNode(node.id),
    }));

    return [...commands, ...nodeActions];
  }, [
    deploy,
    selectNode,
    openLauncher,
    setAiOpen,
    setDockTab,
    setMode,
    setNodeModalOpen,
    setSettings,
    startBuild,
    stopRun,
    toggleDock,
    togglePause,
    tree,
  ]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return actions.slice(0, 18);
    return actions
      .filter((action) =>
        (action.label + " " + action.hint + " " + action.keywords).toLowerCase().includes(normalized),
      )
      .slice(0, 20);
  }, [actions, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!paletteOpen) return null;

  const run = (action: PaletteAction) => {
    action.run();
    setPalette(false);
  };

  return (
    <div
      className="fixed inset-0 z-[72] flex items-start justify-center bg-black/55 px-4 pt-[12vh]"
      onMouseDown={() => setPalette(false)}
    >
      <div
        className="w-[520px] max-w-full overflow-hidden border border-line bg-panel shadow-[0_26px_70px_rgba(0,0,0,0.75)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-[38px] items-center gap-2 border-b border-line px-2.5">
          <Search size={12} className="text-zinc-600" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((value) => Math.min(filtered.length - 1, value + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((value) => Math.max(0, value - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const action = filtered[index];
                if (action) run(action);
              } else if (event.key === "Escape") {
                setPalette(false);
              }
            }}
            placeholder="Run an engine command or jump to a node…"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          <kbd className="border border-line bg-void px-1 py-[1px] font-mono text-[8px] text-zinc-600">
            ESC
          </kbd>
        </div>

        <div className="scroll-thin max-h-[360px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center font-mono text-[9px] text-zinc-600">
              no matching commands
            </div>
          ) : (
            filtered.map((action, itemIndex) => {
              const Icon = action.icon;
              const selected = itemIndex === index;
              return (
                <button
                  key={action.id}
                  type="button"
                  onMouseEnter={() => setIndex(itemIndex)}
                  onClick={() => run(action)}
                  className={cx(
                    "flex h-[28px] w-full items-center gap-2 px-2.5 text-left",
                    selected ? "border-l border-acid bg-elevated" : "border-l border-transparent",
                  )}
                >
                  <Icon
                    size={11}
                    className={cx(selected ? "text-acid" : "text-zinc-600")}
                  />
                  <span className={cx("min-w-0 flex-1 truncate text-[10.5px]", selected ? "text-zinc-100" : "text-zinc-400")}>
                    {action.label}
                  </span>
                  <span className="shrink-0 font-mono text-[8px] text-zinc-700">
                    {action.group}
                  </span>
                  <span className="w-[86px] shrink-0 truncate text-right font-mono text-[8px] text-zinc-600">
                    {action.hint}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex h-[23px] items-center gap-2 border-t border-line px-2.5 font-mono text-[7px] text-zinc-700">
          <Command size={8} />
          <span>↑↓ navigate</span>
          <span>↵ execute</span>
          <span className="ml-auto">{filtered.length} commands</span>
        </div>
      </div>
    </div>
  );
}
