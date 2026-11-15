import { useMemo, useState } from "react";
import {
  ChevronRight,
  Eye,
  EyeOff,
  FileCode2,
  Filter,
  Link2,
  Plus,
  Radio,
  Search,
  X,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { SCENE_ICONS, NODE_KIND_META } from "./nodeMeta";
import { cx } from "../lib/utils";
import type { SceneNode } from "../types";
import { findSceneNode, flattenScene } from "../data/scene";

function matches(node: SceneNode, query: string): boolean {
  const haystack = (node.name + " " + node.className + " " + node.kind).toLowerCase();
  return haystack.includes(query);
}

function subtreeMatches(node: SceneNode, query: string): boolean {
  if (matches(node, query)) return true;
  return (node.children ?? []).some((child) => subtreeMatches(child, query));
}

function SceneRow({
  node,
  depth,
  query,
}: {
  node: SceneNode;
  depth: number;
  query: string;
}) {
  const {
    selectedNodeId,
    expanded,
    nodeStatuses,
    selectNode,
    toggleNode,
    toggleVisibility,
    openFile,
    setRightTab,
    pushLog,
  } = useEngine();
  const [hovered, setHovered] = useState(false);
  const meta = NODE_KIND_META[node.kind];
  const status = nodeStatuses[node.id] ?? node.status;
  const Icon = SCENE_ICONS[node.icon] ?? SCENE_ICONS.control;
  const selected = selectedNodeId === node.id;
  const isExpanded = query ? true : Boolean(expanded[node.id]);
  const hasChildren = Boolean(node.children?.length);

  if (query && !subtreeMatches(node, query)) return null;

  return (
    <>
      <div
        role="treeitem"
        aria-selected={selected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => selectNode(node.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectNode(node.id);
          }
          if (event.key === "ArrowRight" && hasChildren) toggleNode(node.id);
          if (event.key === "ArrowLeft" && hasChildren) toggleNode(node.id);
        }}
        title={node.name + " <" + node.className + "> · " + node.summary}
        className={cx(
          "group relative flex h-6 cursor-default items-center gap-1 border-l-2 pr-1 text-[11px] outline-none transition-colors",
          selected
            ? "border-acid bg-elevated text-zinc-100"
            : "border-transparent text-zinc-400 hover:bg-elevated/70 hover:text-zinc-200",
        )}
        style={{ paddingLeft: 3 + depth * 11 }}
      >
        {selected ? <span className="absolute left-0 top-0 h-full w-[2px] bg-acid" /> : null}
        {hasChildren ? (
          <button
            type="button"
            aria-label={isExpanded ? "Collapse node" : "Expand node"}
            onClick={(event) => {
              event.stopPropagation();
              toggleNode(node.id);
            }}
            className="grid h-3.5 w-3.5 shrink-0 place-items-center text-zinc-600 hover:text-zinc-300"
          >
            <ChevronRight
              size={9}
              className={cx("transition-transform", isExpanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <Icon size={11} className={cx("shrink-0", meta.iconColor)} strokeWidth={1.9} />

        <span className="min-w-0 flex-1 truncate">{node.name}</span>

        {nodeStatuses[node.id] === "error" ? (
          <span className="h-[4px] w-[4px] shrink-0 rounded-full bg-danger" />
        ) : null}
        {status === "running" ? (
          <span className="h-[4px] w-[4px] shrink-0 rounded-full bg-acid status-pulse" />
        ) : null}

        <div
          className={cx(
            "flex shrink-0 items-center gap-[1px] transition-opacity",
            hovered || selected || !node.visible ? "opacity-100" : "opacity-0",
          )}
        >
          {node.file ? (
            <button
              type="button"
              title="Open attached script"
              onClick={(event) => {
                event.stopPropagation();
                openFile(node.file as string);
              }}
              className="grid h-4 w-4 place-items-center text-zinc-600 hover:bg-white/[0.06] hover:text-[#38BDF8]"
            >
              <FileCode2 size={9} />
            </button>
          ) : null}
          {node.signals.length > 0 ? (
            <button
              type="button"
              title="Inspect node signals"
              onClick={(event) => {
                event.stopPropagation();
                selectNode(node.id);
                setRightTab("node");
              }}
              className="grid h-4 w-4 place-items-center text-zinc-600 hover:bg-white/[0.06] hover:text-acid"
            >
              <Radio size={9} />
            </button>
          ) : null}
          <button
            type="button"
            title={node.visible ? "Hide node in viewport" : "Show node in viewport"}
            onClick={(event) => {
              event.stopPropagation();
              toggleVisibility(node.id);
              pushLog(
                "AcidEngine",
                "info",
                (node.visible ? "hidden " : "visible ") + node.id + " · viewport updated",
              );
            }}
            className={cx(
              "grid h-4 w-4 place-items-center hover:bg-white/[0.06]",
              node.visible ? "text-zinc-600 hover:text-zinc-300" : "text-warn",
            )}
          >
            {node.visible ? <Eye size={9} /> : <EyeOff size={9} />}
          </button>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div role="group">
          {node.children?.map((child) => (
            <SceneRow key={child.id} node={child} depth={depth + 1} query={query} />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function SceneDock() {
  const {
    tree,
    nodeStatuses,
    selectedNodeId,
    setNodeModalOpen,
    openFile,
    selectNode,
    setRightTab,
    pushLog,
  } = useEngine();
  const [query, setQuery] = useState("");

  const selected = findSceneNode(tree, selectedNodeId);
  const normalized = query.trim().toLowerCase();
  const allNodes = useMemo(() => flattenScene(tree), [tree]);
  const errors = allNodes.filter((node) => nodeStatuses[node.id] === "error").length;
  const visibleCount = allNodes.filter((node) => node.visible).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex h-[26px] shrink-0 items-center gap-1 border-b border-line px-2">
        <span className="label-caps text-zinc-400">Scene</span>
        <span className="font-mono text-[8px] text-zinc-700">{allNodes.length}</span>
        <div className="ml-auto flex items-center gap-px">
          <button
            type="button"
            title="Create new node"
            onClick={() => setNodeModalOpen(true)}
            className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-acid"
          >
            <Plus size={11} />
          </button>
          <button
            type="button"
            title="Attach script to selected node"
            onClick={() => {
              if (selected?.file) openFile(selected.file);
              else pushLog("AcidEngine", "warn", "selected node has no script to attach");
            }}
            className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-[#38BDF8]"
          >
            <Link2 size={10} />
          </button>
          <button
            type="button"
            title="Inspect selected node signals"
            onClick={() => {
              setRightTab("node");
              selectNode(selectedNodeId);
            }}
            className="grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200"
          >
            <Radio size={10} />
          </button>
        </div>
      </div>

      <div className="flex h-[25px] shrink-0 items-center gap-1 border-b border-line-soft px-1.5">
        <Search size={10} className="shrink-0 text-zinc-600" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter nodes"
          spellCheck={false}
          className="h-[20px] min-w-0 flex-1 bg-transparent px-0.5 text-[10px] text-zinc-300 outline-none placeholder:text-zinc-600"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear node filter"
            className="grid h-4 w-4 place-items-center text-zinc-600 hover:text-zinc-200"
          >
            <X size={9} />
          </button>
        ) : (
          <Filter size={9} className="text-zinc-700" />
        )}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-1" role="tree">
        <SceneRow node={tree} depth={0} query={normalized} />
        {normalized && !subtreeMatches(tree, normalized) ? (
          <div className="px-3 py-4 text-center font-mono text-[9px] text-zinc-600">
            no matching nodes
          </div>
        ) : null}
      </div>

      <div className="flex h-[19px] shrink-0 items-center justify-between border-t border-line-soft px-2 font-mono text-[7.5px] text-zinc-700">
        <span>
          {visibleCount}/{allNodes.length} visible
        </span>
        <span className={errors > 0 ? "text-danger/80" : "text-zinc-700"}>
          {errors > 0 ? errors + " errors" : "0 errors"}
        </span>
        <span className="flex items-center gap-1">
          <span className={cx("h-1 w-1 rounded-full", errors > 0 ? "bg-danger" : "bg-acid/50")} />
          scene
        </span>
      </div>
    </div>
  );
}
