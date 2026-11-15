import { Radio, Waypoints } from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { findSceneNode, scenePath } from "../data/scene";
import { NODE_KIND_META } from "./nodeMeta";

export function NodeSignalsPanel() {
  const { tree, selectedNodeId, setMode, setRightTab } = useEngine();
  const node = findSceneNode(tree, selectedNodeId) ?? tree;
  const trail = scenePath(tree, node.id);
  const meta = NODE_KIND_META[node.kind];

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="flex h-[29px] items-center gap-1.5 border-b border-line px-2">
        <Radio size={10} className="text-acid/70" />
        <span className="label-caps text-[8px] text-zinc-500">Node</span>
        <span className="text-[9px] text-zinc-700">/</span>
        <span className="text-[10px] text-zinc-400">Signals &amp; Groups</span>
        <span className="ml-auto font-mono text-[8px] text-zinc-700">
          {node.signals.length} signals
        </span>
      </div>

      <div className="border-b border-line-soft px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.hex }} />
          <span className="truncate font-mono text-[10px] text-zinc-300">{node.name}</span>
          <span className="ml-auto rounded-[1px] border px-1 font-mono text-[7px] uppercase tracking-[0.08em] text-zinc-600 border-line">
            {node.className}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {trail.map((ancestor) => (
            <span
              key={ancestor.id}
              className="rounded-[1px] border border-line bg-void px-1 py-[1px] font-mono text-[7px] text-zinc-600"
            >
              {ancestor.className}
            </span>
          ))}
          <span className="rounded-[1px] border border-[#38BDF8]/20 bg-[#38BDF8]/[0.04] px-1 py-[1px] font-mono text-[7px] text-[#38BDF8]/60">
            group: view
          </span>
        </div>
      </div>

      <div className="px-2 py-2">
        <div className="mb-1.5 flex items-center gap-1">
          <span className="label-caps text-[7.5px] text-zinc-600">Emitted signals</span>
          <span className="font-mono text-[7px] text-zinc-700">{node.signals.length}</span>
          <button
            type="button"
            onClick={() => setMode("signals")}
            className="ml-auto flex h-[18px] items-center gap-1 border border-line px-1.5 font-mono text-[7.5px] text-zinc-500 hover:border-acid/25 hover:bg-acid/[0.04] hover:text-acid/80"
          >
            <Waypoints size={8} />
            signal graph
          </button>
        </div>

        {node.signals.length === 0 ? (
          <div className="border border-dashed border-line px-3 py-6 text-center">
            <Radio size={14} className="mx-auto text-zinc-700" />
            <p className="mt-1.5 text-[10px] text-zinc-500">No signals on this node.</p>
            <p className="mt-0.5 font-mono text-[8px] text-zinc-700">
              wire one from the Signal Graph workspace
            </p>
            <button
              type="button"
              onClick={() => setMode("signals")}
              className="mt-2 border border-acid/25 bg-acid/[0.04] px-2 py-1 font-mono text-[8px] text-acid/75 hover:bg-acid/[0.08]"
            >
              open signal graph
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {node.signals.map((signal) => (
              <div key={signal.id} className="border border-line bg-void/50">
                <div className="flex items-start gap-1.5 border-b border-line-soft px-1.5 py-1">
                  <Radio size={9} className="mt-[1px] shrink-0 text-acid/60" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[9.5px] text-zinc-300">
                      {signal.name}
                      <span className="text-zinc-600">{signal.args}</span>
                    </div>
                    <div className="mt-[1px] text-[8.5px] leading-snug text-zinc-600">
                      {signal.description}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-[1px] border border-[#A3E635]/20 bg-[#A3E635]/[0.04] px-1 font-mono text-[6.5px] uppercase tracking-[0.06em] text-[#A3E635]/60">
                    live
                  </span>
                </div>
                <div className="px-1.5 py-[3px]">
                  {signal.connections.map((connection) => {
                    const target = findSceneNode(tree, connection.nodeId);
                    return (
                      <div
                        key={connection.nodeId + connection.method}
                        className="flex items-center gap-1 py-[1px] font-mono text-[8px] text-zinc-600"
                      >
                        <span className="text-[#A3E635]/50">↳</span>
                        <span className="truncate text-zinc-500">
                          {target?.name ?? connection.nodeId}
                        </span>
                        <span className="text-zinc-700">.</span>
                        <span className="truncate text-acid/55">{connection.method}()</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line-soft px-2 py-2">
        <div className="label-caps mb-1 text-[7.5px] text-zinc-600">Node groups</div>
        <div className="flex flex-wrap gap-1">
          {[node.kind, "agent-context", "project:northwind", "workspace:production"].map((group) => (
            <span
              key={group}
              className="rounded-[1px] border border-line bg-elevated px-1 py-[1px] font-mono text-[7px] text-zinc-500"
            >
              {group}
            </span>
          ))}
        </div>
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setRightTab("inspector")}
          className="w-full border border-line px-2 py-1 font-mono text-[8px] text-zinc-500 hover:bg-elevated hover:text-zinc-300"
        >
          back to inspector
        </button>
      </div>
    </div>
  );
}
