import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Hexagon,
  Plus,
  Search,
  Sparkles,
  Waypoints,
  X,
} from "lucide-react";
import { useEngine } from "../state/EngineContext";
import { NODE_CATALOG, type CatalogGroup, type NodeClassDef } from "../data/nodeCatalog";
import { NODE_KIND_META, SCENE_ICONS } from "./nodeMeta";
import { findSceneNode, isDescendant, sceneNodeOptions } from "../data/scene";
import { cx } from "../lib/utils";

const TONE_CLASSES: Record<CatalogGroup["tone"], { icon: string; border: string; bg: string }> = {
  ui: {
    icon: "text-[#38BDF8]",
    border: "border-[#38BDF8]/25",
    bg: "bg-[#38BDF8]/[0.06]",
  },
  logic: {
    icon: "text-[#A3E635]",
    border: "border-[#A3E635]/25",
    bg: "bg-[#A3E635]/[0.06]",
  },
  agent: {
    icon: "text-acid",
    border: "border-acid/25",
    bg: "bg-acid/[0.06]",
  },
};

export function AddNodeModal() {
  const {
    nodeModalOpen,
    setNodeModalOpen,
    addNode,
    tree,
    selectedNodeId,
  } = useEngine();

  const [query, setQuery] = useState("");
  const [activeClassId, setActiveClassId] = useState("data-widget");
  const [name, setName] = useState("NewWidget");
  const [parentId, setParentId] = useState(selectedNodeId);

  const activeClass = useMemo(() => {
    for (const group of NODE_CATALOG) {
      const match = group.classes.find((item) => item.id === activeClassId);
      if (match) return match;
    }
    return NODE_CATALOG[0].classes[0];
  }, [activeClassId]);

  const activeGroup = useMemo(
    () =>
      NODE_CATALOG.find((group) => group.classes.some((item) => item.id === activeClass.id)) ??
      NODE_CATALOG[0],
    [activeClass.id],
  );

  useEffect(() => {
    if (!nodeModalOpen) return;
    setQuery("");
    setActiveClassId("data-widget");
    setName("NewWidget");
    setParentId(findSceneNode(tree, selectedNodeId) ? selectedNodeId : "dashboard-page");
  }, [nodeModalOpen, selectedNodeId, tree]);

  useEffect(() => {
    if (!nodeModalOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNodeModalOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [nodeModalOpen, setNodeModalOpen]);

  if (!nodeModalOpen) return null;

  const parent = findSceneNode(tree, parentId);
  const options = sceneNodeOptions(tree);
  const normalized = query.trim().toLowerCase();

  const choose = (item: NodeClassDef) => {
    setActiveClassId(item.id);
    setName(item.defaultName);
  };

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed || !parent) return;
    addNode({
      parentId: parent.id,
      name: trimmed,
      className: activeClass.className,
      kind: activeClass.kind,
      icon: activeClass.icon,
      summary: activeClass.description,
    });
  };

  const tone = TONE_CLASSES[activeGroup.tone];
  const TypeIcon = SCENE_ICONS[activeClass.icon];
  const kindMeta = NODE_KIND_META[activeClass.kind];
  const sceneFile =
    parent?.id === "dashboard-page" || (parent ? isDescendant(tree, "dashboard-page", parent.id) : false)
      ? "DashboardPage.acid"
      : "MainApp.acid";

  const filteredGroups = NODE_CATALOG.map((group) => ({
    ...group,
    classes: group.classes.filter((item) => {
      if (!normalized) return true;
      return (item.label + " " + item.className + " " + item.description)
        .toLowerCase()
        .includes(normalized);
    }),
  })).filter((group) => group.classes.length > 0);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-5"
      onMouseDown={() => setNodeModalOpen(false)}
    >
      <div
        className="flex max-h-[82vh] w-[620px] flex-col overflow-hidden border border-line bg-panel shadow-[0_28px_80px_rgba(0,0,0,0.8)]"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            create();
          }
        }}
      >
        <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-line bg-shell px-3">
          <span className="grid h-[18px] w-[18px] place-items-center rounded-[2px] bg-acid/[0.12]">
            <Plus size={11} className="text-acid" />
          </span>
          <span className="text-[11px] font-semibold tracking-[-0.01em] text-zinc-100">
            Create New Node
          </span>
          <span className="hidden font-mono text-[8.5px] text-zinc-600 sm:inline">
            res://scenes/{sceneFile}
          </span>
          <button
            type="button"
            onClick={() => setNodeModalOpen(false)}
            aria-label="Close create node dialog"
            className="ml-auto grid h-5 w-5 place-items-center text-zinc-500 hover:bg-elevated hover:text-zinc-200"
          >
            <X size={11} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-[296px] shrink-0 flex-col border-r border-line">
            <div className="flex h-[32px] shrink-0 items-center gap-1 border-b border-line-soft px-2">
              <Search size={11} className="text-zinc-600" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search node classes"
                spellCheck={false}
                autoFocus
                className="h-[23px] min-w-0 flex-1 bg-transparent px-0.5 text-[10.5px] text-zinc-300 outline-none placeholder:text-zinc-600"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear class search"
                  className="text-zinc-600 hover:text-zinc-300"
                >
                  <X size={10} />
                </button>
              ) : null}
            </div>

            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
              {filteredGroups.length === 0 ? (
                <div className="px-2 py-6 text-center font-mono text-[9px] text-zinc-600">
                  no node classes found
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const groupTone = TONE_CLASSES[group.tone];
                  return (
                    <div key={group.id} className="mb-2">
                      <div className="flex items-center gap-1.5 px-1 py-1">
                        {group.tone === "agent" ? (
                          <Bot size={10} className={groupTone.icon} />
                        ) : group.tone === "logic" ? (
                          <Waypoints size={10} className={groupTone.icon} />
                        ) : (
                          <Hexagon size={10} className={groupTone.icon} />
                        )}
                        <span className="label-caps text-[8.5px] text-zinc-500">{group.label}</span>
                        <span className="ml-auto font-mono text-[7.5px] text-zinc-700">
                          {group.classes.length}
                        </span>
                      </div>
                      {group.classes.map((item) => {
                        const Icon = SCENE_ICONS[item.icon];
                        const active = item.id === activeClassId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => choose(item)}
                            className={cx(
                              "group flex w-full items-center gap-2 border px-2 py-[5px] text-left transition-colors",
                              active
                                ? "border-acid/30 bg-acid/[0.06]"
                                : "border-transparent hover:border-line hover:bg-elevated/70",
                            )}
                          >
                            <span
                              className={cx(
                                "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[2px] border",
                                groupTone.border,
                                groupTone.bg,
                              )}
                            >
                              <Icon
                                size={12}
                                className={cx(
                                  active ? "text-acid" : groupTone.icon,
                                )}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cx(
                                  "block truncate text-[10.5px]",
                                  active ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200",
                                )}
                              >
                                {item.label}
                              </span>
                              <span className="mt-[1px] block truncate font-mono text-[7.5px] text-zinc-700">
                                {item.className}
                              </span>
                            </span>
                            {active ? <Check size={10} className="shrink-0 text-acid" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
              <div className="flex items-start gap-2.5">
                <span
                  className={cx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-[2px] border",
                    tone.border,
                    tone.bg,
                  )}
                >
                  <TypeIcon size={18} className={tone.icon} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-[12.5px] font-semibold text-zinc-100">
                      {activeClass.label}
                    </h2>
                    <span
                      className={cx(
                        "rounded-[1px] border px-1 font-mono text-[7.5px] uppercase tracking-[0.08em]",
                        kindMeta.border,
                        kindMeta.text,
                      )}
                    >
                      {kindMeta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    {activeClass.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <label className="block">
                  <span className="label-caps mb-1 block text-[8.5px] text-zinc-600">Node name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") create();
                    }}
                    spellCheck={false}
                    className="engine-input h-[24px] font-mono text-[10.5px]"
                    placeholder="e.g. RealtimeWidget"
                  />
                </label>

                <label className="block">
                  <span className="label-caps mb-1 block text-[8.5px] text-zinc-600">
                    Parent node
                  </span>
                  <div className="relative">
                    <select
                      value={parentId}
                      onChange={(event) => setParentId(event.target.value)}
                      className="engine-select h-[24px]"
                    >
                      {options.map(({ node, depth }) => (
                        <option key={node.id} value={node.id}>
                          {"— ".repeat(depth)}
                          {node.name} ({node.className})
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={9}
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600"
                    />
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="label-caps mb-1 block text-[8.5px] text-zinc-600">Type</span>
                    <div className="flex h-[24px] items-center gap-1.5 rounded-[2px] border border-line bg-void px-2 font-mono text-[9.5px] text-zinc-400">
                      <TypeIcon size={10} className={tone.icon} />
                      {activeClass.className}
                    </div>
                  </div>
                  <div>
                    <span className="label-caps mb-1 block text-[8.5px] text-zinc-600">
                      Attach to
                    </span>
                    <div className="flex h-[24px] items-center gap-1.5 rounded-[2px] border border-line bg-void px-2 font-mono text-[9.5px] text-zinc-400">
                      {parent?.name ?? "MainApp"}
                    </div>
                  </div>
                </div>

                {activeClass.kind === "agent" ? (
                  <div className="border border-acid/20 bg-acid/[0.035] px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={10} className="text-acid" />
                      <span className="text-[9.5px] text-acid/80">Agent defaults</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[8px] text-zinc-600">
                      <span>model=claude-sonnet-4-6</span>
                      <span>autonomy=Full-Acid</span>
                      <span>maxSteps=25</span>
                    </div>
                  </div>
                ) : null}

                <p className="border border-line/60 bg-void/60 px-2 py-1.5 font-mono text-[8px] leading-relaxed text-zinc-600">
                  node will be inserted under{" "}
                  <span className="text-zinc-400">{parent?.name ?? "MainApp"}</span> · id will be
                  generated from the node name · the scene tree and viewport selection update
                  immediately.
                </p>
              </div>
            </div>

            <div className="flex h-[38px] shrink-0 items-center justify-end gap-1.5 border-t border-line bg-shell px-2.5">
              <span className="mr-auto hidden font-mono text-[8px] text-zinc-700 sm:inline">
                ⌘↵ create
              </span>
              <button
                type="button"
                onClick={() => setNodeModalOpen(false)}
                className="h-[24px] border border-line px-2.5 text-[10.5px] text-zinc-400 hover:bg-elevated hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={create}
                disabled={!name.trim() || !parent}
                className="flex h-[24px] items-center gap-1 border border-acid/50 bg-acid px-2.5 text-[10.5px] font-medium text-[#0b0d04] transition-colors hover:bg-[#d7ff33] disabled:cursor-not-allowed disabled:border-line disabled:bg-elevated disabled:text-zinc-600"
              >
                <Plus size={10} />
                Create Node
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
