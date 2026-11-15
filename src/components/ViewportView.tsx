import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Crosshair,
  Eye,
  Grid3X3,
  Layers,
  Maximize2,
  Monitor,
  MousePointer2,
  Move,
  Scaling,
  Sparkles,
  Smartphone,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { findSceneNode, flattenScene, scenePath } from "../data/scene";
import { NODE_KIND_META } from "./nodeMeta";
import { PreviewApp } from "./preview/PreviewApp";
import { cx } from "../lib/utils";
import type { ViewportTool } from "../types";

const REGION_IDS = new Set([
  "top-navbar",
  "auth-gate",
  "auth-super-agent",
  "dashboard-page",
  "metrics-grid",
  "live-feed-api",
  "data-analyst-agent",
]);

function CornerHandles() {
  return (
    <>
      <span className="selection-handle -left-[3px] -top-[3px]" />
      <span className="selection-handle -right-[3px] -top-[3px]" />
      <span className="selection-handle -bottom-[3px] -left-[3px]" />
      <span className="selection-handle -bottom-[3px] -right-[3px]" />
    </>
  );
}

function ViewToggle({
  icon: Icon,
  label,
  checked,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[23px] w-full items-center gap-2 px-2 text-left text-[10.5px] text-zinc-400 hover:bg-elevated hover:text-zinc-200"
    >
      <span
        className={cx(
          "grid h-[11px] w-[11px] place-items-center border",
          checked ? "border-acid/60 bg-acid/10 text-acid" : "border-line bg-void text-transparent",
        )}
      >
        <Check size={8} strokeWidth={2.5} />
      </span>
      <Icon size={10} className="text-zinc-600" />
      <span className="flex-1">{label}</span>
    </button>
  );
}

export function ViewportView() {
  const {
    tree,
    selectedNodeId,
    device,
    setDevice,
    zoom,
    setZoom,
    run,
    runtime,
  } = useEngine();
  const [tool, setTool] = useState<ViewportTool>("select");
  const [snap, setSnap] = useState(true);
  const [liveOverlay, setLiveOverlay] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showChrome, setShowChrome] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);

  const selected = findSceneNode(tree, selectedNodeId);
  const trail = scenePath(tree, selectedNodeId);
  const parentLabel = trail.length > 1 ? trail[trail.length - 2].name : "res://";
  const hiddenNodeIds = useMemo(
    () => flattenScene(tree).filter((node) => !node.visible).map((node) => node.id),
    [tree],
  );

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    const rect = element.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!viewOpen) return;
    const close = (event: MouseEvent) => {
      if (!viewRef.current?.contains(event.target as Node)) setViewOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [viewOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key.toLowerCase() === "q") setTool("select");
      if (event.key.toLowerCase() === "w") setTool("move");
      if (event.key.toLowerCase() === "e") setTool("resize");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const baseWidth = device === "mobile" ? 390 : 1440;
  const baseHeight = device === "mobile" ? 844 : 900;
  const fit =
    size.width > 0 && size.height > 0
      ? Math.min(
          Math.max(size.width - 88, 120) / baseWidth,
          Math.max(size.height - 86, 120) / baseHeight,
          1,
        )
      : 0.6;
  const scale = Math.max(0.2, fit * zoom);
  const zoomPercent = Math.round(scale * 100);
  const busy = run.status === "building" || run.status === "deploying";
  const running = busy || run.status === "running";
  const addedNode = selected && !REGION_IDS.has(selected.id) && selected.id !== "main-app" && selected.id !== "workspace-shell";
  const selectedHidden = selected ? !selected.visible : false;
  const sceneFile =
    selectedNodeId === "dashboard-page" || trail.some((node) => node.id === "dashboard-page")
      ? "DashboardPage.acid"
      : "MainApp.acid";

  const cursor =
    tool === "move" ? "cursor-grab" : tool === "resize" ? "cursor-nwse-resize" : "cursor-default";

  const liveAgentLabel = run.currentAgent ?? (running ? "DataAnalystAgent" : null);
  const steps = Math.max(1, Math.round((run.progress / 100) * 25));

  return (
    <div className="flex h-full min-h-0 flex-col bg-void">
      <div className="flex h-[30px] shrink-0 items-center border-b border-line bg-panel px-1.5">
        <div className="flex items-center gap-px">
          {(
            [
              { id: "select", label: "Select [Q]", icon: MousePointer2 },
              { id: "move", label: "Move / reorder [W]", icon: Move },
              { id: "resize", label: "Resize [E]", icon: Scaling },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-pressed={tool === item.id}
                onClick={() => setTool(item.id)}
                className={cx(
                  "grid h-[22px] w-[22px] place-items-center border transition-colors",
                  tool === item.id
                    ? "border-acid/25 bg-acid/[0.07] text-acid"
                    : "border-transparent text-zinc-500 hover:border-line hover:bg-elevated hover:text-zinc-200",
                )}
              >
                <Icon size={11} />
              </button>
            );
          })}
        </div>

        <span className="mx-1 h-3.5 w-px bg-line" />

        <button
          type="button"
          onClick={() => setSnap((value) => !value)}
          title="Snap to grid"
          className={cx(
            "flex h-[22px] items-center gap-1 border px-1.5 text-[9.5px]",
            snap
              ? "border-acid/20 bg-acid/[0.05] text-acid/85"
              : "border-transparent text-zinc-500 hover:border-line hover:bg-elevated hover:text-zinc-300",
          )}
        >
          <Grid3X3 size={10} />
          <span className="hidden xl:inline">Snap</span>
        </button>

        <span className="mx-1 h-3.5 w-px bg-line" />

        <div className="flex items-center rounded-[2px] border border-line bg-void p-[1px]">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            title="Responsive frame · Desktop 1440px"
            className={cx(
              "flex h-[19px] items-center gap-1 px-1.5 text-[9px]",
              device === "desktop"
                ? "bg-elevated text-zinc-200"
                : "text-zinc-600 hover:text-zinc-300",
            )}
          >
            <Monitor size={9} />
            <span className="hidden lg:inline">Desktop</span>
            <span className="font-mono text-[7.5px] text-zinc-600">1440</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            title="Responsive frame · Mobile 390px"
            className={cx(
              "flex h-[19px] items-center gap-1 px-1.5 text-[9px]",
              device === "mobile"
                ? "bg-elevated text-zinc-200"
                : "text-zinc-600 hover:text-zinc-300",
            )}
          >
            <Smartphone size={9} />
            <span className="hidden lg:inline">Mobile</span>
            <span className="font-mono text-[7.5px] text-zinc-600">390</span>
          </button>
        </div>

        <div className="ml-2 hidden min-w-0 items-center gap-1.5 font-mono text-[8.5px] text-zinc-600 xl:flex">
          <Layers size={9} className="shrink-0 text-zinc-700" />
          <span className="truncate">res://scenes/{sceneFile}</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLiveOverlay((value) => !value)}
            aria-pressed={liveOverlay}
            title="Toggle live agent overlay"
            className={cx(
              "flex h-[22px] items-center gap-1 border px-1.5 text-[9px]",
              liveOverlay
                ? "border-acid/20 bg-acid/[0.05] text-acid/85"
                : "border-transparent text-zinc-500 hover:border-line hover:bg-elevated hover:text-zinc-300",
            )}
          >
            <Sparkles size={9} />
            <span className="hidden xl:inline">Agent Overlay</span>
          </button>

          <div className="relative" ref={viewRef}>
            <button
              type="button"
              onClick={() => setViewOpen((value) => !value)}
              title="View options"
              aria-label="View options"
              aria-expanded={viewOpen}
              className={cx(
                "flex h-[22px] items-center gap-1 border px-1.5 text-[9px]",
                viewOpen
                  ? "border-line bg-elevated text-zinc-200"
                  : "border-transparent text-zinc-500 hover:border-line hover:bg-elevated hover:text-zinc-300",
              )}
            >
              <Eye size={9} />
              <span className="hidden xl:inline">View</span>
              <ChevronDown size={8} className="text-zinc-600" />
            </button>
            {viewOpen ? (
              <div className="absolute right-0 top-[25px] z-50 w-[190px] border border-line bg-panel py-1 shadow-[0_12px_28px_rgba(0,0,0,0.55)]">
                <ViewToggle icon={Grid3X3} label="Show grid" checked={showGrid} onClick={() => setShowGrid((value) => !value)} />
                <ViewToggle icon={Monitor} label="Device chrome" checked={showChrome} onClick={() => setShowChrome((value) => !value)} />
                <ViewToggle icon={Sparkles} label="Live agent overlay" checked={liveOverlay} onClick={() => setLiveOverlay((value) => !value)} />
                <div className="my-1 border-t border-line" />
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setViewOpen(false);
                  }}
                  className="flex h-[23px] w-full items-center gap-2 px-2 text-left text-[10.5px] text-zinc-400 hover:bg-elevated hover:text-zinc-200"
                >
                  <Maximize2 size={10} className="text-zinc-600" />
                  Fit to view
                  <span className="ml-auto font-mono text-[8px] text-zinc-600">100%</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-px rounded-[2px] border border-line bg-void p-[1px]">
            <button
              type="button"
              title="Zoom out"
              onClick={() => setZoom(Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10))}
              disabled={zoom <= 0.5}
              className="grid h-[19px] w-[19px] place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
            >
              <ZoomOut size={9} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Reset zoom"
              className="h-[19px] min-w-[34px] px-1 font-mono text-[8.5px] text-zinc-400 hover:bg-elevated hover:text-zinc-200"
            >
              {zoomPercent}%
            </button>
            <button
              type="button"
              title="Zoom in"
              onClick={() => setZoom(Math.min(1.5, Math.round((zoom + 0.1) * 10) / 10))}
              disabled={zoom >= 1.5}
              className="grid h-[19px] w-[19px] place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
            >
              <ZoomIn size={9} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={cx(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden",
          showGrid ? "engine-grid" : "bg-void",
          cursor,
        )}
      >
        <div className="pointer-events-none absolute left-3 top-2 z-20 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-zinc-700">
          <span className="flex items-center gap-1 text-acid/70">
            <Crosshair size={9} />
            Viewport
          </span>
          <span className="text-zinc-800">/</span>
          <span>2D</span>
          <span className="text-zinc-800">/</span>
          <span className="normal-case tracking-normal text-zinc-500">{sceneFile}</span>
        </div>
        <div className="pointer-events-none absolute right-3 top-2 z-20 flex items-center gap-2 font-mono text-[8px] text-zinc-700">
          <span className={runtime.status === "online" ? "text-acid/50" : "text-warn/60"}>
            ● {runtime.status === "online" ? "agent runtime" : "reference runtime"}
          </span>
          <span>60 fps</span>
        </div>

        <div
          className="relative shrink-0"
          style={{
            width: baseWidth,
            height: baseHeight,
            transform: "scale(" + scale + ")",
            transformOrigin: "center center",
          }}
        >
          <div
            className={cx(
              "relative flex h-full w-full flex-col overflow-hidden border bg-[#0a0c0d] shadow-[0_26px_80px_rgba(0,0,0,0.6)] transition-colors",
              selectedNodeId === "main-app"
                ? "border-acid/80"
                : "border-[#2a3136] hover:border-[#3a4248]",
            )}
          >
            {selectedNodeId === "main-app" ? (
              <>
                <span className="pointer-events-none absolute -left-[1px] -top-[1px] z-50 h-[5px] w-[5px] bg-acid" />
                <span className="pointer-events-none absolute -right-[1px] -top-[1px] z-50 h-[5px] w-[5px] bg-acid" />
                <span className="pointer-events-none absolute -bottom-[1px] -left-[1px] z-50 h-[5px] w-[5px] bg-acid" />
                <span className="pointer-events-none absolute -bottom-[1px] -right-[1px] z-50 h-[5px] w-[5px] bg-acid" />
              </>
            ) : null}

            {showChrome ? (
              <div className="flex h-[26px] shrink-0 items-center gap-2 border-b border-[#20262a] bg-[#0d1012] px-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-[5px] w-[5px] rounded-full bg-[#3c454b]" />
                  <span className="h-[5px] w-[5px] rounded-full bg-[#3c454b]" />
                  <span className="h-[5px] w-[5px] rounded-full bg-[#3c454b]" />
                </div>
                <span className="ml-2 font-mono text-[9px] text-zinc-600">
                  res://scenes/{sceneFile}
                </span>
                <span className="ml-auto flex items-center gap-2 font-mono text-[8.5px] text-zinc-700">
                  <span className="text-acid/40">●</span>
                  {device === "desktop" ? "1440 × 900" : "390 × 844"}
                </span>
              </div>
            ) : null}

            <div className="relative min-h-0 flex-1 overflow-hidden select-text">
              <PreviewApp
                device={device}
                selectedNodeId={selectedNodeId}
                hiddenNodeIds={hiddenNodeIds}
                agentOverlay={liveOverlay && running}
              />

              {selectedNodeId === "workspace-shell" ? (
                <div className="pointer-events-none absolute inset-[5px] z-30 selection-box">
                  <span className="absolute -top-[14px] left-1 bg-acid px-1 py-[1px] font-mono text-[7px] font-semibold uppercase tracking-[0.08em] text-[#0a0d02]">
                    WorkspaceShell
                  </span>
                  <CornerHandles />
                </div>
              ) : null}

              {addedNode ? (
                <div className="pointer-events-none absolute left-[28%] top-[36%] z-30 h-[26%] w-[44%] selection-box">
                  <span className="absolute -top-[14px] left-1 whitespace-nowrap bg-acid px-1 py-[1px] font-mono text-[7px] font-semibold uppercase tracking-[0.08em] text-[#0a0d02]">
                    {selected?.name} · {selected?.className}
                  </span>
                  <CornerHandles />
                  <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap border border-acid/25 bg-void/90 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-acid/70">
                    new node · not composited
                  </span>
                </div>
              ) : null}

              {selectedNodeId === "main-app" ? (
                <span className="pointer-events-none absolute right-2 top-2 z-40 bg-acid px-1.5 py-[2px] font-mono text-[7px] font-semibold uppercase tracking-[0.08em] text-[#0a0d02]">
                  AppRoot · MainApp
                </span>
              ) : null}

              {selectedHidden ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-40 bg-warn/10 px-2 py-0.5 text-center font-mono text-[8px] text-warn/80">
                  node hidden from viewport · {selected?.name}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {device === "mobile" ? (
          <span className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[7.5px] uppercase tracking-[0.16em] text-zinc-700">
            mobile frame 390 × 844
          </span>
        ) : null}

        {liveOverlay && running ? (
          <div className="pointer-events-none absolute right-3 bottom-6 z-40 w-[188px] border border-acid/25 bg-[#070a04]/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-1.5">
              <span className="h-[4px] w-[4px] rounded-full bg-acid status-pulse" />
              <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-acid/70">
                live agent overlay
              </span>
              <span className="ml-auto font-mono text-[7px] text-zinc-600">{run.progress}%</span>
            </div>
            <div className="mt-1.5 truncate font-mono text-[9px] text-zinc-300">
              {liveAgentLabel ?? "DataAnalystAgent"}
            </div>
            <div className="mt-1 font-mono text-[7.5px] text-zinc-600">
              step {steps}/25 · {busy ? "executing" : "scene live"}
            </div>
            <div className="mt-1.5 h-[2px] overflow-hidden bg-white/[0.08]">
              <div
                className="h-full bg-acid transition-all duration-500"
                style={{ width: run.progress + "%" }}
              />
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-2 left-3 z-20 flex items-center gap-3 font-mono text-[8px] text-zinc-700">
          <span className="flex items-center gap-1">
            <MousePointer2 size={8} />
            {tool} tool
          </span>
          <span>{snap ? "snap 8px" : "free"}</span>
          <span className="text-zinc-800">{parentLabel}</span>
        </div>
        <div className="pointer-events-none absolute bottom-2 right-3 z-20 flex items-center gap-3 font-mono text-[8px] text-zinc-700">
          <span>{selected ? NODE_KIND_META[selected.kind].label : "—"}</span>
          <span>{zoomPercent}%</span>
          <span>{device === "desktop" ? "DESKTOP" : "MOBILE"}</span>
        </div>
      </div>
    </div>
  );
}
