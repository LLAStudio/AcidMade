import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Crosshair,
  GitBranch,
  Maximize2,
  Plus,
  Radio,
  RefreshCcw,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import {
  SIGNAL_GRAPH_EDGES,
  SIGNAL_GRAPH_NODES,
  SIGNAL_TRACE,
  type SignalGraphEdge,
} from "../data/signalGraph";
import { findSceneNode } from "../data/scene";
import { NODE_KIND_META, SCENE_ICONS, STATUS_META } from "./nodeMeta";
import { cx } from "../lib/utils";

const NODE_W = 156;
const NODE_H = 54;
const CANVAS_W = 1050;
const CANVAS_H = 610;

const TONE_COLOR: Record<SignalGraphEdge["tone"], string> = {
  ui: "#38BDF8",
  logic: "#A3E635",
  agent: "#CCFF00",
};

type Positions = Record<string, { x: number; y: number }>;

function initialPositions(): Positions {
  return Object.fromEntries(SIGNAL_GRAPH_NODES.map((node) => [node.id, { x: node.x, y: node.y }]));
}

function edgeGeometry(edge: SignalGraphEdge, positions: Positions) {
  const from = positions[edge.from] ?? { x: 0, y: 0 };
  const to = positions[edge.to] ?? { x: 0, y: 0 };
  const forward = to.x >= from.x;
  const x1 = from.x + (forward ? NODE_W : 0);
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x + (forward ? 0 : NODE_W);
  const y2 = to.y + NODE_H / 2;
  const delta = Math.max(44, Math.abs(x2 - x1) * 0.45);
  const sign = forward ? 1 : -1;
  const path = `M ${x1} ${y1} C ${x1 + sign * delta} ${y1}, ${x2 - sign * delta} ${y2}, ${x2} ${y2}`;
  return {
    path,
    labelX: (x1 + x2) / 2,
    labelY: (y1 + y2) / 2,
    color: TONE_COLOR[edge.tone],
    x1,
    y1,
    x2,
    y2,
  };
}

export function SignalGraphView() {
  const {
    tree,
    selectedNodeId,
    nodeStatuses,
    selectNode,
    pushLog,
    run,
    runtime,
  } = useEngine();
  const [positions, setPositions] = useState<Positions>(initialPositions);
  const [zoom, setZoom] = useState(0.86);
  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      setPositions((current) => ({
        ...current,
        [drag.id]: {
          x: Math.max(0, Math.min(CANVAS_W - NODE_W, drag.originX + (event.clientX - drag.startX) / zoom)),
          y: Math.max(0, Math.min(CANVAS_H - NODE_H, drag.originY + (event.clientY - drag.startY) / zoom)),
        },
      }));
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, zoom]);

  const edges = useMemo(
    () => SIGNAL_GRAPH_EDGES.map((edge) => ({ edge, geometry: edgeGeometry(edge, positions) })),
    [positions],
  );

  const selected = findSceneNode(tree, selectedNodeId);
  const running = run.status === "running" || run.status === "building";
  const agents = SIGNAL_GRAPH_NODES.filter((node) => findSceneNode(tree, node.id)?.kind === "agent").length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-void">
      <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
        <Waypoints size={12} className="text-acid/75" />
        <div className="flex items-center gap-1 font-mono text-[9.5px]">
          <span className="text-zinc-600">res://</span>
          <span className="text-zinc-300">signals/main.signal</span>
        </div>
        <span className="border border-line bg-void px-1 font-mono text-[7px] uppercase tracking-[0.08em] text-zinc-600">
          graph
        </span>
        <span className="hidden items-center gap-1 font-mono text-[8px] text-zinc-700 xl:flex">
          <GitBranch size={8} />
          {SIGNAL_GRAPH_EDGES.length} connections
        </span>
        <span className="hidden items-center gap-1 font-mono text-[8px] text-zinc-700 xl:flex">
          <Radio size={8} />
          {SIGNAL_GRAPH_NODES.length} nodes
        </span>

        <div className="ml-auto flex items-center gap-1">
          <span
            className={cx(
              "hidden items-center gap-1 border px-1.5 py-[2px] font-mono text-[7.5px] uppercase tracking-[0.08em] xl:flex",
              running
                ? "border-acid/25 bg-acid/[0.05] text-acid/70"
                : "border-line bg-void text-zinc-600",
            )}
          >
            <span className={cx("h-1 w-1 rounded-full", running ? "bg-acid live-dot" : "bg-zinc-700")} />
            {running ? "signal trace live" : "dormant"}
          </span>
          <button
            type="button"
            onClick={() => {
              pushLog("SignalWrangler", "info", "opened signal wiring matrix · 10 edges resolved");
            }}
            className="flex h-[21px] items-center gap-1 border border-line px-1.5 font-mono text-[8px] text-zinc-500 hover:border-acid/25 hover:text-acid/80"
          >
            <Plus size={8} />
            Wire
          </button>
          <button
            type="button"
            onClick={() => setPositions(initialPositions())}
            title="Reset graph layout"
            className="grid h-[21px] w-[21px] place-items-center border border-transparent text-zinc-600 hover:border-line hover:bg-elevated hover:text-zinc-300"
          >
            <RefreshCcw size={9} />
          </button>
          <div className="flex items-center rounded-[2px] border border-line bg-void p-[1px]">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.05) * 100) / 100))}
              className="grid h-[19px] w-[19px] place-items-center text-zinc-600 hover:bg-elevated hover:text-zinc-200"
              title="Zoom out"
            >
              <ZoomOut size={9} />
            </button>
            <span className="min-w-[32px] text-center font-mono text-[8px] text-zinc-500">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(1.4, Math.round((value + 0.05) * 100) / 100))}
              className="grid h-[19px] w-[19px] place-items-center text-zinc-600 hover:bg-elevated hover:text-zinc-200"
              title="Zoom in"
            >
              <ZoomIn size={9} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.86)}
              className="grid h-[19px] w-[19px] place-items-center text-zinc-600 hover:bg-elevated hover:text-zinc-200"
              title="Fit graph"
            >
              <Maximize2 size={8} />
            </button>
          </div>
        </div>
      </div>

      <div className="scroll-thin relative min-h-0 flex-1 overflow-auto">
        <div
          style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
          className="relative"
        >
          <div
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
            }}
            className="bp-grid absolute left-0 top-0 overflow-hidden"
          >
            <div className="pointer-events-none absolute left-3 top-2 z-10 flex items-center gap-2 font-mono text-[7.5px] uppercase tracking-[0.12em] text-zinc-700">
              <Crosshair size={8} className="text-acid/50" />
              signal network
              <span className="text-zinc-800">/</span>
              <span className="normal-case tracking-normal">acid/1.0</span>
            </div>
            <div className="pointer-events-none absolute right-3 top-2 z-10 flex items-center gap-2 font-mono text-[7px] text-zinc-700">
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-[#38BDF8]" /> ui
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-[#A3E635]" /> data
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-acid" /> agent
              </span>
            </div>

            <svg
              width={CANVAS_W}
              height={CANVAS_H}
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
            >
              <defs>
                {(Object.entries(TONE_COLOR) as [SignalGraphEdge["tone"], string][]).map(
                  ([tone, color]) => (
                    <marker
                      key={tone}
                      id={"signal-arrow-" + tone}
                      viewBox="0 0 6 6"
                      refX="5"
                      refY="3"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M0,0 L6,3 L0,6 Z" fill={color} opacity="0.75" />
                    </marker>
                  ),
                )}
              </defs>
              {edges.map(({ edge, geometry }) => (
                <g key={edge.id}>
                  <path
                    d={geometry.path}
                    fill="none"
                    stroke={geometry.color}
                    strokeOpacity="0.26"
                    strokeWidth="3"
                  />
                  <path
                    d={geometry.path}
                    fill="none"
                    stroke={geometry.color}
                    strokeOpacity="0.8"
                    strokeWidth="1.1"
                    markerEnd={"url(#signal-arrow-" + edge.tone + ")"}
                    className={running ? "agent-edge" : undefined}
                  />
                  <circle cx={geometry.x1} cy={geometry.y1} r="2.4" fill={geometry.color} />
                  <circle cx={geometry.x2} cy={geometry.y2} r="2.4" fill="#050506" stroke={geometry.color} strokeWidth="1" />
                </g>
              ))}
            </svg>

            {edges.map(({ edge, geometry }) => (
              <div
                key={"label-" + edge.id}
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border border-line bg-void/95 px-1 py-[1px] font-mono text-[7px]"
                style={{
                  left: geometry.labelX,
                  top: geometry.labelY,
                  color: geometry.color,
                  borderColor: geometry.color + "33",
                }}
              >
                {edge.signal}
              </div>
            ))}

            {SIGNAL_GRAPH_NODES.map((entry) => {
              const node = findSceneNode(tree, entry.id);
              if (!node) return null;
              const position = positions[entry.id] ?? { x: entry.x, y: entry.y };
              const meta = NODE_KIND_META[node.kind];
              const Icon = SCENE_ICONS[node.icon] ?? SCENE_ICONS.control;
              const status = nodeStatuses[node.id] ?? node.status;
              const selected = node.id === selectedNodeId;
              const dragActive = drag?.id === node.id;
              return (
                <div
                  key={node.id}
                  style={{ left: position.x, top: position.y, width: NODE_W, height: NODE_H }}
                  className={cx(
                    "absolute z-20 border bg-panel/95 shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-colors",
                    selected
                      ? "border-acid/70"
                      : "border-line hover:border-zinc-600",
                    dragActive && "cursor-grabbing",
                  )}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    selectNode(node.id);
                    setDrag({
                      id: node.id,
                      startX: event.clientX,
                      startY: event.clientY,
                      originX: position.x,
                      originY: position.y,
                    });
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") selectNode(node.id);
                  }}
                  title={node.summary}
                >
                  <span
                    className="absolute bottom-0 left-0 top-0 w-[2px]"
                    style={{ backgroundColor: meta.hex }}
                  />
                  <div className="flex h-[21px] cursor-grab items-center gap-1.5 border-b border-line-soft px-2 pl-2.5 active:cursor-grabbing">
                    <Icon size={9} style={{ color: meta.hex }} />
                    <span className="truncate text-[9.5px] font-medium text-zinc-200">
                      {node.name}
                    </span>
                    <span className={cx("ml-auto h-[3px] w-[3px] rounded-full", STATUS_META[status].dot)} />
                  </div>
                  <div className="flex h-[20px] items-center gap-1.5 px-2 pl-2.5">
                    <span className="truncate font-mono text-[7px] text-zinc-600">
                      {node.className}
                    </span>
                    <span className="ml-auto font-mono text-[6.5px] uppercase tracking-[0.06em] text-zinc-700">
                      {node.signals.length} sig
                    </span>
                  </div>
                  <div className="absolute -left-[3px] top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full border border-zinc-600 bg-void" />
                  <div
                    className="absolute -right-[3px] top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full border bg-void"
                    style={{ borderColor: meta.hex }}
                  />
                  {selected ? (
                    <span className="absolute -top-[9px] right-0 bg-acid px-1 py-[1px] font-mono text-[6.5px] uppercase tracking-[0.08em] text-[#0b0d04]">
                      selected
                    </span>
                  ) : null}
                </div>
              );
            })}

            <div className="pointer-events-none absolute bottom-2 left-3 z-10 flex items-center gap-2 font-mono text-[7px] text-zinc-700">
              <span>{SIGNAL_GRAPH_EDGES.length} edges</span>
              <span className="text-zinc-800">/</span>
              <span>{agents} agent nodes</span>
              <span className="text-zinc-800">/</span>
              <span>drag nodes to inspect routing</span>
            </div>
            <div className="pointer-events-none absolute bottom-2 right-3 z-10 flex items-center gap-2 font-mono text-[7px] text-zinc-700">
              <span className={runtime.status === "online" ? "text-acid/40" : "text-warn/50"}>
                {runtime.status === "online" ? "runtime online" : "reference trace"}
              </span>
              <span>acidmade · signal bus</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-4 right-4 z-30 w-[268px] border border-line bg-[#07090b]/95 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="flex h-[21px] items-center gap-1.5 border-b border-line px-2">
            <Activity size={8} className="text-acid/60" />
            <span className="label-caps text-[7px] text-zinc-500">signal trace</span>
            <span className="ml-auto flex items-center gap-1 font-mono text-[6.5px] text-acid/45">
              <span className="h-1 w-1 rounded-full bg-acid/60 live-dot" />
              live
            </span>
          </div>
          {SIGNAL_TRACE.slice(0, 4).map((trace) => (
            <div key={trace.time} className="flex items-center gap-1.5 border-b border-line-soft/60 px-2 py-[3px] font-mono text-[7px] last:border-0">
              <span className="text-zinc-700">{trace.time}</span>
              <span className="truncate text-zinc-500">{trace.signal}</span>
              <span className="ml-auto h-[3px] w-[3px] shrink-0 rounded-full" style={{ backgroundColor: TONE_COLOR[trace.tone as SignalGraphEdge["tone"]] }} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex h-[19px] shrink-0 items-center gap-2 border-t border-line-soft bg-shell px-2 font-mono text-[7px] text-zinc-700">
        <Waypoints size={8} className="text-acid/40" />
        <span className="text-zinc-600">{selected?.name ?? "—"}</span>
        <span className="text-zinc-800">|</span>
        <span>{selected?.signals.length ?? 0} signals</span>
        <span className="ml-auto">drag · select · wire</span>
      </div>
    </div>
  );
}
